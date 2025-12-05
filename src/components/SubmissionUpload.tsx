import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Upload, FileCheck, AlertCircle, Loader2, Trophy, Clock, FileText } from "lucide-react";
import { parseCSV, scoreSubmission, validateSubmission } from "@/lib/scoring";
import { ref, uploadBytes, getDownloadURL, getBytes } from "firebase/storage";
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc, query, where, getDocs, orderBy } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";

interface SubmissionUploadProps {
  competitionId: string;
  competition?: any;
  competitionType?: "competition" | "playground";
  onSubmissionComplete?: () => void;
}

export const SubmissionUpload = ({ 
  competitionId, 
  competition, 
  competitionType = "competition",
  onSubmissionComplete 
}: SubmissionUploadProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<any>(null);
  const [todaySubmissions, setTodaySubmissions] = useState(0);
  const [userBestScore, setUserBestScore] = useState<number | null>(null);

  const idColumn = competition?.idColumn || "id";
  const targetColumn = competition?.targetColumn || "prediction";
  const maxDailySubmissions = competition?.maxSubmissionsPerDay || competition?.submissionFormat?.maxSubmissionsPerDay || 5;
  const testRows = competition?.testRows || 0;

  // Get the correct collection path based on competition type
  const getCollectionPath = (subCollection: string) => {
    const basePath = competitionType === "playground" ? "playgrounds" : "competitions";
    return `${basePath}/${competitionId}/${subCollection}`;
  };

  useEffect(() => {
    if (user && competitionId) {
      fetchUserStats();
    }
  }, [user, competitionId]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const submissionsRef = collection(db, getCollectionPath("submissions"));
      const todayQuery = query(
        submissionsRef,
        where("userId", "==", user.uid),
        orderBy("submittedAt", "desc")
      );
      
      const snapshot = await getDocs(todayQuery);
      const todayCount = snapshot.docs.filter(doc => {
        const submittedAt = doc.data().submittedAt?.toDate();
        return submittedAt && submittedAt >= today;
      }).length;
      
      setTodaySubmissions(todayCount);

      // Get user's best score
      const leaderboardDoc = await getDoc(doc(db, getCollectionPath("leaderboard"), user.uid));
      if (leaderboardDoc.exists()) {
        setUserBestScore(leaderboardDoc.data().score);
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationErrors([]);
    setParsedData(null);

    // Check file type
    if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setValidationErrors(["File must be a CSV file"]);
      toast.error("Invalid file type");
      return;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setValidationErrors(["File size must be less than 10MB"]);
      toast.error("File too large");
      return;
    }

    try {
      const text = await selectedFile.text();
      const parsed = parseCSV(text);
      
      // Validate structure
      const validation = validateSubmission(parsed, testRows || parsed.rowCount, idColumn, targetColumn);
      
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        toast.error("CSV validation failed");
      } else {
        setParsedData(parsed);
        toast.success(`Valid CSV with ${parsed.rowCount} predictions`);
      }
    } catch (error) {
      setValidationErrors(["Failed to parse CSV file"]);
      toast.error("Failed to parse file");
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!file || !user || validationErrors.length > 0) return;

    if (todaySubmissions >= maxDailySubmissions) {
      toast.error(`Daily submission limit reached (${maxDailySubmissions}/day)`);
      return;
    }

    setUploading(true);

    try {
      // Upload to Firebase Storage
      const timestamp = Date.now();
      const storagePath = `submissions/${competitionType}/${competitionId}/${user.uid}/${timestamp}.csv`;
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(snapshot.ref);

      // Calculate score using ground truth
      let score = 0;
      let scoringError: string | null = null;
      const metric = competition?.scoringMethod || competition?.evaluationMetric || "accuracy";

      if (competition?.groundTruthPath && parsedData) {
        try {
          const truthRef = ref(storage, competition.groundTruthPath);
          const truthBytes = await getBytes(truthRef);
          const truthText = new TextDecoder().decode(truthBytes);
          const groundTruth = parseCSV(truthText);
          
          const result = scoreSubmission(
            parsedData, 
            groundTruth, 
            metric,
            idColumn,
            targetColumn
          );
          
          if (result.valid) {
            score = result.score;
          } else {
            scoringError = result.error || "Scoring failed";
          }
        } catch (error) {
          console.error("Error loading ground truth:", error);
          scoringError = "Could not access ground truth file";
        }
      } else {
        scoringError = "No ground truth configured for this competition";
      }

      // Create submission record
      const submissionData: any = {
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userAvatar: user.photoURL || null,
        score: score,
        fileUrl: fileUrl,
        fileName: file.name,
        rowCount: parsedData?.rowCount || 0,
        submittedAt: serverTimestamp(),
        status: scoringError ? "error" : "scored",
        errorMessage: scoringError || null,
      };

      await addDoc(collection(db, getCollectionPath("submissions")), submissionData);

      // Update leaderboard only if scoring was successful
      if (!scoringError) {
        const leaderboardRef = doc(db, getCollectionPath("leaderboard"), user.uid);
        const existingEntry = await getDoc(leaderboardRef);
        
        const currentSubmissions = existingEntry.exists() ? (existingEntry.data().submissions || 0) : 0;
        const currentBestScore = existingEntry.exists() ? (existingEntry.data().score || 0) : 0;
        
        const shouldUpdateBest = score > currentBestScore;
        
        await setDoc(leaderboardRef, {
          userId: user.uid,
          userName: user.displayName || "Anonymous",
          userAvatar: user.photoURL || null,
          score: shouldUpdateBest ? score : currentBestScore,
          bestScore: shouldUpdateBest ? score : currentBestScore,
          submissions: currentSubmissions + 1,
          lastSubmission: serverTimestamp(),
        }, { merge: true });

        const improved = userBestScore !== null && score > userBestScore;
        toast.success(
          improved 
            ? `New best score! ${score.toFixed(4)} (↑${(score - userBestScore).toFixed(4)})`
            : `Submission scored: ${score.toFixed(4)}`
        );
        
        setUserBestScore(prev => Math.max(prev || 0, score));
      } else {
        toast.warning(`Submission saved but scoring failed: ${scoringError}`);
      }
      
      setFile(null);
      setParsedData(null);
      setTodaySubmissions(prev => prev + 1);
      
      if (onSubmissionComplete) onSubmissionComplete();
      
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error(`Failed to submit: ${error.message || "Please try again"}`);
    } finally {
      setUploading(false);
    }
  };

  const remainingSubmissions = maxDailySubmissions - todaySubmissions;

  return (
    <div className="space-y-6">
      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Best Score</p>
              <p className="text-xl font-bold">
                {userBestScore !== null ? userBestScore.toFixed(4) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <Clock className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Daily Submissions</p>
              <p className="text-xl font-bold">{todaySubmissions}/{maxDailySubmissions}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Metric</p>
              <p className="text-xl font-bold capitalize">
                {competition?.scoringMethod || competition?.evaluationMetric || "Accuracy"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submission Card */}
      <Card>
        <CardHeader>
          <CardTitle>Submit Your Prediction</CardTitle>
          <CardDescription>
            Upload a CSV file with your predictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {remainingSubmissions <= 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You've reached the daily submission limit. Try again tomorrow!
              </AlertDescription>
            </Alert>
          )}

          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc ml-4 mt-2 space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {parsedData && validationErrors.length === 0 && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <FileCheck className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-500">
                File validated: {parsedData.rowCount} predictions ready to submit
              </AlertDescription>
            </Alert>
          )}

          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            {file ? (
              <div className="space-y-2">
                <FileCheck className="h-12 w-12 mx-auto text-secondary" />
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                {parsedData?.rowCount && (
                  <Badge variant="secondary">
                    {parsedData.rowCount} rows
                  </Badge>
                )}
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop or click to upload
                </p>
              </>
            )}
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
              disabled={remainingSubmissions <= 0}
            />
            <label htmlFor="csv-upload">
              <Button 
                variant="outline" 
                className="mt-2" 
                asChild
                disabled={remainingSubmissions <= 0}
              >
                <span>{file ? "Choose Different File" : "Choose File"}</span>
              </Button>
            </label>
          </div>

          {/* Requirements */}
          <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-3">
            <p className="font-semibold">Submission Requirements:</p>
            <ul className="list-disc ml-4 space-y-1 text-muted-foreground">
              <li>
                Required columns: 
                <Badge variant="outline" className="ml-1 text-xs">{idColumn}</Badge>
                <Badge variant="outline" className="ml-1 text-xs">{targetColumn}</Badge>
              </li>
              {testRows > 0 && (
                <li>Expected rows: {testRows}</li>
              )}
              <li>Maximum file size: 10MB</li>
              <li>Format: CSV with comma delimiter</li>
            </ul>
          </div>

          {/* Daily limit progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Daily submissions</span>
              <span>{remainingSubmissions} remaining</span>
            </div>
            <Progress value={(todaySubmissions / maxDailySubmissions) * 100} />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!file || uploading || validationErrors.length > 0 || remainingSubmissions <= 0 || !parsedData}
            className="w-full bg-gradient-to-r from-primary to-secondary"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Submission...
              </>
            ) : (
              "Submit Prediction"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
