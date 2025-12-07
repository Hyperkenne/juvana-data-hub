import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileCheck, AlertCircle, Loader2, FileText, Database, Lock } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { toast } from "sonner";

interface DatasetFiles {
  train: File | null;
  test: File | null;
  groundTruth: File | null;
}

interface DatasetValidation {
  trainColumns: string[];
  testColumns: string[];
  groundTruthColumns: string[];
  trainRows: number;
  testRows: number;
  groundTruthRows: number;
  idColumn: string;
  targetColumn: string;
  valid: boolean;
  errors: string[];
}

interface UploadedDataset {
  trainUrl: string;
  testUrl: string;
  groundTruthPath: string;
  trainRows: number;
  testRows: number;
  idColumn: string;
  targetColumn: string;
}

interface CompetitionDatasetUploadProps {
  onUploadComplete: (dataset: UploadedDataset) => void;
  competitionType: "competition" | "playground";
  competitionId?: string;
}

export const CompetitionDatasetUpload = ({ 
  onUploadComplete, 
  competitionType,
  competitionId 
}: CompetitionDatasetUploadProps) => {
  const [files, setFiles] = useState<DatasetFiles>({
    train: null,
    test: null,
    groundTruth: null,
  });
  const [validation, setValidation] = useState<DatasetValidation | null>(null);
  const [uploading, setUploading] = useState(false);
  const [idColumn, setIdColumn] = useState("id");
  const [targetColumn, setTargetColumn] = useState("target");

  const parseCSVHeaders = async (file: File): Promise<{ headers: string[]; rowCount: number }> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return { headers, rowCount: lines.length - 1 };
  };

  const handleFileChange = async (type: keyof DatasetFiles, file: File | null) => {
    const newFiles = { ...files, [type]: file };
    setFiles(newFiles);

    // Validate when all files are uploaded
    if (newFiles.train && newFiles.test && newFiles.groundTruth) {
      await validateDatasets(newFiles);
    }
  };

  const validateDatasets = async (datasetFiles: DatasetFiles) => {
    const errors: string[] = [];

    try {
      const [trainData, testData, groundTruthData] = await Promise.all([
        parseCSVHeaders(datasetFiles.train!),
        parseCSVHeaders(datasetFiles.test!),
        parseCSVHeaders(datasetFiles.groundTruth!),
      ]);

      const result: DatasetValidation = {
        trainColumns: trainData.headers,
        testColumns: testData.headers,
        groundTruthColumns: groundTruthData.headers,
        trainRows: trainData.rowCount,
        testRows: testData.rowCount,
        groundTruthRows: groundTruthData.rowCount,
        idColumn,
        targetColumn,
        valid: true,
        errors: [],
      };

      // Check ID column exists in all files
      if (!trainData.headers.includes(idColumn.toLowerCase())) {
        errors.push(`Train file missing ID column: "${idColumn}"`);
      }
      if (!testData.headers.includes(idColumn.toLowerCase())) {
        errors.push(`Test file missing ID column: "${idColumn}"`);
      }
      if (!groundTruthData.headers.includes(idColumn.toLowerCase())) {
        errors.push(`Ground truth file missing ID column: "${idColumn}"`);
      }

      // Check target column in train and ground truth (but NOT in test)
      if (!trainData.headers.includes(targetColumn.toLowerCase())) {
        errors.push(`Train file missing target column: "${targetColumn}"`);
      }
      if (testData.headers.includes(targetColumn.toLowerCase())) {
        errors.push(`Test file should NOT contain target column: "${targetColumn}"`);
      }
      if (!groundTruthData.headers.includes(targetColumn.toLowerCase())) {
        errors.push(`Ground truth file missing target column: "${targetColumn}"`);
      }

      // Check row counts match
      if (testData.rowCount !== groundTruthData.rowCount) {
        errors.push(`Test rows (${testData.rowCount}) must match ground truth rows (${groundTruthData.rowCount})`);
      }

      result.errors = errors;
      result.valid = errors.length === 0;
      setValidation(result);

    } catch (error) {
      console.error("Validation error:", error);
      setValidation({
        trainColumns: [],
        testColumns: [],
        groundTruthColumns: [],
        trainRows: 0,
        testRows: 0,
        groundTruthRows: 0,
        idColumn,
        targetColumn,
        valid: false,
        errors: ["Failed to parse CSV files. Ensure they are valid CSV format."],
      });
    }
  };

  const handleUpload = async () => {
    if (!files.train || !files.test || !files.groundTruth || !validation?.valid) return;

    setUploading(true);
    try {
      const tempId = competitionId || `temp_${Date.now()}`;
      const basePath = competitionType === "playground" 
        ? `playgrounds/${tempId}` 
        : `competitions/${tempId}`;

      // Upload all three files in parallel
      const [trainSnapshot, testSnapshot, groundTruthSnapshot] = await Promise.all([
        uploadBytes(ref(storage, `${basePath}/train.csv`), files.train),
        uploadBytes(ref(storage, `${basePath}/test.csv`), files.test),
        uploadBytes(ref(storage, `${basePath}/ground_truth.csv`), files.groundTruth),
      ]);

      // Get download URLs for train and test (public)
      const [trainUrl, testUrl] = await Promise.all([
        getDownloadURL(trainSnapshot.ref),
        getDownloadURL(testSnapshot.ref),
      ]);

      // Ground truth path (not URL - kept private)
      const groundTruthPath = `${basePath}/ground_truth.csv`;

      const uploadedDataset: UploadedDataset = {
        trainUrl,
        testUrl,
        groundTruthPath,
        trainRows: validation.trainRows,
        testRows: validation.testRows,
        idColumn,
        targetColumn,
      };

      onUploadComplete(uploadedDataset);
      toast.success("Dataset uploaded successfully!");

    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload dataset files");
    } finally {
      setUploading(false);
    }
  };

  const FileInput = ({ 
    label, 
    description, 
    type, 
    icon: Icon,
    isPrivate = false 
  }: { 
    label: string; 
    description: string; 
    type: keyof DatasetFiles; 
    icon: any;
    isPrivate?: boolean;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {label}
          {isPrivate && (
            <Badge variant="secondary" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Hidden
            </Badge>
          )}
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
        {files[type] ? (
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium">{files[type]!.name}</span>
            <Badge variant="outline" className="text-xs">
              {(files[type]!.size / 1024).toFixed(1)} KB
            </Badge>
          </div>
        ) : (
          <div className="text-center text-muted-foreground text-sm">
            Drop CSV or click to select
          </div>
        )}
        <Input
          type="file"
          accept=".csv"
          className="hidden"
          id={`file-${type}`}
          onChange={(e) => handleFileChange(type, e.target.files?.[0] || null)}
        />
        <label htmlFor={`file-${type}`}>
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <span>{files[type] ? "Change" : "Select"} File</span>
          </Button>
        </label>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Competition Dataset
        </CardTitle>
        <CardDescription>
          Upload train, test, and ground truth CSV files for automatic scoring
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Column Configuration */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <Label htmlFor="idColumn">ID Column Name</Label>
            <Input
              id="idColumn"
              value={idColumn}
              onChange={(e) => setIdColumn(e.target.value)}
              placeholder="e.g., PassengerId, id"
            />
          </div>
          <div>
            <Label htmlFor="targetColumn">Target/Prediction Column</Label>
            <Input
              id="targetColumn"
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              placeholder="e.g., Survived, target"
            />
          </div>
        </div>

        {/* File Uploads */}
        <div className="grid gap-4">
          <FileInput
            label="Training Data (train.csv)"
            description={`Must include ${idColumn} column and ${targetColumn} column with labels`}
            type="train"
            icon={FileText}
          />
          <FileInput
            label="Test Data (test.csv)"
            description={`Must include ${idColumn} column but NO ${targetColumn} column`}
            type="test"
            icon={FileText}
          />
          <FileInput
            label="Ground Truth (ground_truth.csv)"
            description={`Must include ${idColumn} and ${targetColumn} columns. Rows must match test.csv`}
            type="groundTruth"
            icon={Lock}
            isPrivate
          />
        </div>

        {/* Validation Results */}
        {validation && (
          <div className="space-y-3">
            {validation.valid ? (
              <Alert className="border-green-500/50 bg-green-500/10">
                <FileCheck className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-600">
                  Dataset validated successfully!
                  <div className="mt-2 text-sm grid grid-cols-3 gap-2">
                    <span>Train: {validation.trainRows} rows</span>
                    <span>Test: {validation.testRows} rows</span>
                    <span>Ground Truth: {validation.groundTruthRows} rows</span>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc ml-4 mt-1 space-y-1">
                    {validation.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!validation?.valid || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading Dataset...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Dataset Files
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
