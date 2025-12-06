import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Download, FileText, ExternalLink, Loader2, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, orderBy, limit, updateDoc, increment } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface CompetitionDataProps {
  competitionId: string;
  datasetId?: string;
  // Direct file URLs for competitions/playgrounds
  trainUrl?: string;
  testUrl?: string;
}

interface DataFile {
  name: string;
  url: string;
  size?: number;
  type: "train" | "test";
}

export const CompetitionData = ({ 
  competitionId, 
  datasetId,
  trainUrl,
  testUrl 
}: CompetitionDataProps) => {
  const [dataset, setDataset] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [directFiles, setDirectFiles] = useState<DataFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [datasetId, trainUrl, testUrl]);

  const loadData = async () => {
    setLoading(true);
    
    // Check for direct file URLs first (from playground/competition uploads)
    if (trainUrl || testUrl) {
      const directFilesList: DataFile[] = [];
      
      if (trainUrl) {
        directFilesList.push({
          name: "train.csv",
          url: trainUrl,
          type: "train"
        });
      }
      
      if (testUrl) {
        directFilesList.push({
          name: "test.csv", 
          url: testUrl,
          type: "test"
        });
      }
      
      setDirectFiles(directFilesList);
      setLoading(false);
      return;
    }

    // Fall back to linked dataset approach
    if (!datasetId) {
      setLoading(false);
      return;
    }

    try {
      // Load dataset info
      const datasetDoc = await getDoc(doc(db, "datasets", datasetId));
      if (datasetDoc.exists()) {
        setDataset({ id: datasetDoc.id, ...datasetDoc.data() });
      }

      // Load latest version files
      const versionsQuery = query(
        collection(db, `datasets/${datasetId}/versions`),
        orderBy("version", "desc"),
        limit(1)
      );
      const versionsSnap = await getDocs(versionsQuery);
      if (!versionsSnap.empty) {
        setFiles(versionsSnap.docs[0].data().files || []);
      }
    } catch (error) {
      console.error("Error loading competition data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectDownload = async (file: DataFile) => {
    setDownloading(file.name);
    try {
      // File URL is already a public download URL
      const response = await fetch(file.url);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast({ title: "Download started", description: `Downloading ${file.name}` });
    } catch (error) {
      console.error("Download error:", error);
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleDatasetDownload = async (file: any) => {
    setDownloading(file.name);
    try {
      const fileRef = ref(storage, file.url);
      const downloadUrl = await getDownloadURL(fileRef);
      
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      if (datasetId) {
        await updateDoc(doc(db, "datasets", datasetId), {
          downloadCount: increment(1)
        });
      }

      toast({ title: "Download started", description: `Downloading ${file.name}` });
    } catch (error) {
      console.error("Download error:", error);
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          Loading data...
        </CardContent>
      </Card>
    );
  }

  // Show direct files if available (from competition/playground uploads)
  if (directFiles.length > 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Competition Data Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {directFiles.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {file.type === "train" ? "Training data with labels" : "Test data for predictions"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleDirectDownload(file)}
                    disabled={downloading === file.name}
                  >
                    {downloading === file.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Usage Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              How to Use the Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Training Data (train.csv)</h4>
              <p className="text-sm text-muted-foreground">
                Contains input features and the target label. Use this to train your machine learning model.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Test Data (test.csv)</h4>
              <p className="text-sm text-muted-foreground">
                Contains input features only (no labels). Generate predictions for this dataset and submit them.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Submission Format</h4>
              <p className="text-sm text-muted-foreground">
                Your submission should be a CSV with two columns: the ID column and your prediction column.
                Make sure the row count matches the test data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fall back to linked dataset display
  if (!datasetId || !dataset) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No dataset linked to this competition yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dataset Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Competition Dataset
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/datasets/${datasetId}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Full Dataset
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{dataset.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{dataset.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{files.length} files</Badge>
              <Badge variant="outline">v{dataset.latestVersion || 1}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle>Data Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDatasetDownload(file)}
                  disabled={downloading === file.name}
                >
                  {downloading === file.name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Description */}
      {dataset.description && (
        <Card>
          <CardHeader>
            <CardTitle>About the Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{dataset.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};