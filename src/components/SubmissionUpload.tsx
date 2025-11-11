import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Upload, FileCheck, AlertCircle, Loader2 } from "lucide-react";
import { validateCSV } from "@/lib/csvValidation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Alert, AlertDescription } from "./ui/alert";

interface SubmissionUploadProps {
  competitionId: string;
  onSubmissionComplete?: () => void;
}

export const SubmissionUpload = ({ competitionId, onSubmissionComplete }: SubmissionUploadProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationErrors([]);

    // Validate immediately
    const result = await validateCSV(selectedFile);
    if (!result.valid) {
      setValidationErrors(result.errors);
      toast.error("Invalid CSV file");
    } else {
      toast.success(`Valid CSV with ${result.rowCount} predictions`);
    }
  };

  const handleSubmit = async () => {
    if (!file || !user || validationErrors.length > 0) return;

    setUploading(true);

    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `submissions/${competitionId}/${user.uid}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(snapshot.ref);

      // Parse CSV for scoring
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = values[i];
        });
        return obj;
      });

      // Calculate score (mock scoring - in production, compare with ground truth)
      const score = Math.random() * 0.3 + 0.7; // Random score between 0.7-1.0

      // Create submission record
      await addDoc(collection(db, `competitions/${competitionId}/submissions`), {
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userAvatar: user.photoURL || null,
        score: score,
        fileUrl: fileUrl,
        fileName: file.name,
        rowCount: data.length,
        submittedAt: serverTimestamp(),
        status: "scored",
      });

      // Update or create leaderboard entry
      const leaderboardRef = doc(db, `competitions/${competitionId}/leaderboard`, user.uid);
      await updateDoc(leaderboardRef, {
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userAvatar: user.photoURL || null,
        score: score,
        submissions: increment(1),
        lastSubmission: serverTimestamp(),
      }).catch(async () => {
        // If document doesn't exist, create it
        await addDoc(collection(db, `competitions/${competitionId}/leaderboard`), {
          userId: user.uid,
          userName: user.displayName || "Anonymous",
          userAvatar: user.photoURL || null,
          score: score,
          submissions: 1,
          lastSubmission: serverTimestamp(),
        });
      });

      toast.success(`Submission successful! Score: ${score.toFixed(4)}`);
      setFile(null);
      if (onSubmissionComplete) onSubmissionComplete();
      
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Your Prediction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc ml-4 mt-2">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            {file ? (
              <div className="space-y-2">
                <FileCheck className="h-12 w-12 mx-auto text-secondary" />
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Upload your submission file (CSV format)
                </p>
              </>
            )}
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button variant="outline" className="mt-2" asChild>
                <span>{file ? "Choose Different File" : "Choose File"}</span>
              </Button>
            </label>
          </div>

          <div className="bg-muted/30 p-4 rounded-lg text-sm">
            <p className="font-semibold mb-2">Requirements:</p>
            <ul className="list-disc ml-4 space-y-1 text-muted-foreground">
              <li>CSV format with "id" and "prediction" columns</li>
              <li>Maximum file size: 10MB</li>
              <li>One prediction per row</li>
              <li>Predictions must be numeric values</li>
            </ul>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!file || uploading || validationErrors.length > 0}
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
        </div>
      </CardContent>
    </Card>
  );
};
