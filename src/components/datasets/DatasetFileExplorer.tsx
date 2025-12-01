import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DatasetFileExplorerProps {
  datasetId: string;
}

const DatasetFileExplorer = ({ datasetId }: DatasetFileExplorerProps) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
        setFiles(latestVersion.files || []);
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

  const handleDownload = (file: any) => {
    window.open(file.url, "_blank");
    toast({ title: "Download started", description: `Downloading ${file.name}` });
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
        <CardTitle>Files</CardTitle>
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
                <Button size="sm" variant="outline" onClick={() => handleDownload(file)}>
                  <Download className="h-4 w-4" />
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