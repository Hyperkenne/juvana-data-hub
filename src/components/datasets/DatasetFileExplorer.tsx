import { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, increment } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DatasetFileExplorerProps {
  datasetId: string;
  onFilesLoaded?: (files: any[]) => void;
}

const DatasetFileExplorer = ({ datasetId, onFilesLoaded }: DatasetFileExplorerProps) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadFiles();
  }, [datasetId]);

  const loadFiles = async () => {
    try {
      const q = query(
        collection(db, `datasets/${datasetId}/versions`),
        orderBy("version", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const latestVersion = snap.docs[0].data();
        const loadedFiles = latestVersion.files || [];
        setFiles(loadedFiles);
        onFilesLoaded?.(loadedFiles);
      }
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const handleDownload = async (file: any) => {
    setDownloading(file.name);
    try {
      // Get the actual download URL from Firebase Storage
      const fileRef = ref(storage, file.url);
      const downloadUrl = await getDownloadURL(fileRef);
      
      // Fetch the file as blob to force download
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create a download link
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      // Increment download count
      await updateDoc(doc(db, "datasets", datasetId), {
        downloadCount: increment(1)
      });

      toast({ title: "Download started", description: `Downloading ${file.name}` });
    } catch (error) {
      console.error("Download error:", error);
      toast({ 
        title: "Download failed", 
        description: "Could not download file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading files...</div>;
  }

  if (files.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No files available</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Files ({files.length})</CardTitle>
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
              <div className="flex gap-2">
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DatasetFileExplorer;