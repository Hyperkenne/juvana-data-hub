import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Download, FileText, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, orderBy, limit, updateDoc, increment } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface CompetitionDataProps {
  competitionId: string;
  datasetId?: string;
}

export const CompetitionData = ({ competitionId, datasetId }: CompetitionDataProps) => {
  const [dataset, setDataset] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [datasetId]);

  const loadData = async () => {
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

  const handleDownload = async (file: any) => {
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
          Loading data...
        </CardContent>
      </Card>
    );
  }

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
                  onClick={() => handleDownload(file)}
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
