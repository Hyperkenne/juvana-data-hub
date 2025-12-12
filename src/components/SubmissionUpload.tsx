import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Upload, FileCheck, AlertCircle, Loader2, Trophy, Clock, FileText } from "lucide-react";
import { parseCSV, validateSubmission } from "@/lib/scoring";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  runTransaction
} from "firebase/firestore";
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

  const idColumn = (competition?.idColumn || "id").toString();
  const targetColumn = (competition?.targetColumn || "prediction").toString();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, competitionId]);

  /**
   * Fetch today's submission count and best score.
   * Avoids creating a composite index by using a single-field query
   * (where userId == uid) and then filtering timestamps client-side.
   */
  const fetchUserStats = async () => {
    if (!user) return;

    try {
      const submissionsRef = collection(db, getCollectionPath("submissions"));

      // Query submissions for this user (no orderBy to avoid composite index requirement)
      const q = query(submissionsRef, where("userId", "==", user.uid));
      const snap = await getDocs(q);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayCount = snap.docs.filter(d => {
        const s = d.data().submittedAt;
        if (!s) return false;
        const submittedAt = s.toDate ? s.toDate() : new Date(s);
        return submittedAt >= today;
      }).length;

      setTodaySubmissions(todayCount);

      // Get user's best score without assuming index
      const leaderboardRef = doc(db, getCollectionPath("leaderboard"), user.uid);
      const lbDoc = await getDoc(leaderboardRef);
      if (lbDoc.exists()) {
        const score = lbDoc.data()?.score;
        setUserBestScore(typeof score === "number" ? score : null);
      } else {
        setUserBestScore(null);
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
      // Do not block submission on stats error — show gentle message
      toast.error("Could not load user stats. Submission still possible.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationErrors([]);
    setParsedData(null);

    // Check file type
    if (!selectedFile.name.toLowerCase().endsWith('.csv') && selectedFile.type !== 'text/csv') {
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
        setValidationErrors(validation.errors || ["CSV validation failed"]);
        toast.error("CSV validation failed");
      } else {
        setParsedData(parsed);
        toast.success(`Valid CSV with ${parsed.rowCount} predictions`);
      }
    } catch (error) {
      console.error("Parse error:", error);
      setValidationErrors(["Failed to parse CSV file"]);
      toast.error("Failed to parse file");
    }
  };

  /**
   * Call scoring Cloud Function using fetch API with retries
   */
  const callScoreFunctionWithRetry = async (payload: any, maxRetries = 3): Promise<any> => {
    const cloudFunctionUrl = 'https://us-central1-juvana-895bf.cloudfunctions.net/scoreSubmissionFunction';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt} of ${maxRetries} to call scoring function`);
        
        const response = await fetch(cloudFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add authorization if needed
            // 'Authorization': `Bearer ${await user?.getIdToken()}`
          },
          body: JSON.stringify(payload),
        });

        // Log response for debugging
        console.log('📥 Response status:', response.status);
        
        const responseText = await response.text();
        console.log('📥 Raw response:', responseText);

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          throw new Error(`Invalid JSON response from server: ${responseText.substring(0, 200)}`);
        }

        if (!response.ok) {
          console.error('❌ API Error:', result);
          throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }

        console.log('✅ Scoring successful:', result);
        return result;

      } catch (error: any) {
        console.error(`Score function attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!file || !user || validationErrors.length > 0 || !parsedData) return;

    if (todaySubmissions >= maxDailySubmissions) {
      toast.error(`Daily submission limit reached (${maxDailySubmissions}/day)`);
      return;
    }

    setUploading(true);

    // Create a submission record first (pending)
    let submissionRef: any = null;
    try {
      const submissionData: any = {
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userAvatar: user.photoURL || null,
        score: 0,
        fileUrl: null,
        filePath: null,
        fileName: file.name,
        rowCount: parsedData?.rowCount || 0,
        submittedAt: serverTimestamp(),
        status: "pending",
      };

      submissionRef = await addDoc(collection(db, getCollectionPath("submissions")), submissionData);
    } catch (err) {
      console.error("Failed to create initial submission record:", err);
      toast.error("Failed to create submission. Try again.");
      setUploading(false);
      return;
    }

    try {
      // Upload file to storage
      const timestamp = Date.now();
      const storagePath = `submissions/${competitionType}/${competitionId}/${user.uid}/${timestamp}.csv`;
      const storageRef = ref(storage, storagePath);
      const uploadSnap = await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(uploadSnap.ref);

      // Update submission with file info (so it shows immediately)
      await setDoc(doc(db, getCollectionPath("submissions"), submissionRef.id), {
        fileUrl,
        filePath: storagePath,
      }, { merge: true });

      // If there is no ground truth, mark unscored and bail out
      const groundTruthPath = competition?.groundTruthPath;
      if (!groundTruthPath) {
        await setDoc(doc(db, getCollectionPath("submissions"), submissionRef.id), {
          status: "unscored",
        }, { merge: true });

        toast.warning("No ground truth configured. Submission saved without scoring.");
        setFile(null);
        setParsedData(null);
        setTodaySubmissions(prev => prev + 1);
        if (onSubmissionComplete) onSubmissionComplete();
        return;
      }

      // Call scoring function with retry
      toast.info("Scoring your submission...");
      const payload = {
        submissionPath: storagePath,
        competitionId,
        competitionType,
        groundTruthPath,
        scoringMethod: competition?.scoringMethod || competition?.evaluationMetric || "accuracy",
        idColumn,
        targetColumn,
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userAvatar: user.photoURL || null,
      };

      console.log('🚀 Calling scoring function with payload:', payload);
      const result = await callScoreFunctionWithRetry(payload, 3);

      // FIXED: Handle the nested response structure properly
      // The result is the full API response: {success: true, timestamp: "...", data: {...}}
      if (!result || !result.success) {
        // Handle API-level failure (outer success = false)
        await setDoc(doc(db, getCollectionPath("submissions"), submissionRef.id), {
          status: "error",
          errorMessage: result?.error || "API request failed",
        }, { merge: true });
        toast.warning(`Scoring failed: ${result?.error || "Unknown API error"}`);
      } else if (result.data && result.data.valid) {
        // SUCCESS PATH: result.data contains the scoring result
        const score = result.data.score;
        
        // Update submission with score
        await setDoc(doc(db, getCollectionPath("submissions"), submissionRef.id), {
          score: score,
          status: "scored",
          scoredAt: serverTimestamp(),
        }, { merge: true });

        // Update leaderboard in a transaction to prevent races
        try {
          const leaderboardRef = doc(db, getCollectionPath("leaderboard"), user.uid);

          await runTransaction(db, async (tx) => {
            const lbSnap = await tx.get(leaderboardRef);
            const existing = lbSnap.exists() ? lbSnap.data() : null;
            const currentBest = existing?.score ?? 0;
            const submissionsCount = existing?.submissions ?? 0;
            const shouldUpdate = score > currentBest;

            const updateData: any = {
              userId: user.uid,
              userName: user.displayName || "Anonymous",
              userAvatar: user.photoURL || null,
              submissions: submissionsCount + 1,
              lastSubmission: serverTimestamp(),
            };

            if (shouldUpdate) {
              updateData.score = score;
              updateData.bestScore = score;
            } else {
              updateData.score = currentBest;
            }

            tx.set(leaderboardRef, updateData, { merge: true });
          });
        } catch (lbErr) {
          console.error("Leaderboard update failed:", lbErr);
          // Don't fail the whole flow — submission is scored, leaderboard can be fixed later
          toast.warning("Leaderboard update failed. Score saved.");
        }

        const prevBest = userBestScore ?? 0;
        const improved = score > prevBest;
        setUserBestScore(prev => Math.max(prev ?? 0, score));

        toast.success(improved
          ? `New best score! ${score.toFixed(4)} (↑${(score - prevBest).toFixed(4)})`
          : `Submission scored: ${score.toFixed(4)}`
        );
      } else {
        // Scoring was invalid (outer success = true, but inner valid = false)
        const errorMessage = result.data?.error || "Scoring returned invalid result";
        await setDoc(doc(db, getCollectionPath("submissions"), submissionRef.id), {
          status: "error",
          errorMessage: errorMessage,
        }, { merge: true });
        toast.warning(`Scoring failed: ${errorMessage}`);
      }

      // success path: reset local UI state
      setFile(null);
      setParsedData(null);
      setTodaySubmissions(prev => prev + 1);
      if (onSubmissionComplete) onSubmissionComplete();

    } catch (fnError: any) {
      console.error("Cloud function or upload error:", fnError);

      // Distinguish between transient and permanent errors (best-effort)
      const message = fnError?.message || String(fnError) || "Server scoring failed";

      // Mark submission for later processing but keep the record (non-fatal)
      try {
        await setDoc(doc(db, getCollectionPath("submissions"), submissionRef.id), {
          status: "error",
          errorMessage: message,
        }, { merge: true });
      } catch (updateErr) {
        console.error("Failed to update submission status after scoring failure:", updateErr);
      }

      // Give clearer advice to developer / user
      toast.warning("Submission saved but server scoring failed. It will be processed later.");
    } finally {
      setUploading(false);
    }
  };

  const remainingSubmissions = Math.max(0, maxDailySubmissions - todaySubmissions);

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
            Upload a CSV file with your predictions. Scoring is handled securely on the server.
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
              disabled={remainingSubmissions <= 0 || uploading}
            />
            <label htmlFor="csv-upload">
              <Button
                variant="outline"
                className="mt-2"
                asChild
                disabled={remainingSubmissions <= 0 || uploading}
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

export default SubmissionUpload;