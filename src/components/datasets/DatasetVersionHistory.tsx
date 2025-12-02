import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Download, GitCommit, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Version {
  id: string;
  version: number;
  changelog?: string;
  totalSize?: number;
  files?: any[];
  createdAt?: any;
  createdByName?: string;
}

const DatasetVersionHistory = ({ datasetId }: { datasetId: string }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [datasetId]);

  const load = async () => {
    try {
      const q = query(
        collection(db, `datasets/${datasetId}/versions`),
        orderBy("version", "desc")
      );
      const snap = await getDocs(q);
      setVersions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Version)));
    } catch (error) {
      console.error("Error loading versions:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading versions...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCommit className="h-5 w-5" />
          Version History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No versions available</p>
        ) : (
          <div className="space-y-4">
            {versions.map((v, idx) => (
              <div
                key={v.id}
                className={`relative pl-6 pb-4 ${idx !== versions.length - 1 ? "border-l-2 border-muted ml-2" : "ml-2"}`}
              >
                {/* Timeline dot */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-background" />
                </div>

                <div className="border rounded-lg p-4 hover:bg-muted/30 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={idx === 0 ? "default" : "secondary"}>
                          v{v.version}
                        </Badge>
                        {idx === 0 && (
                          <Badge variant="outline" className="text-xs">Latest</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {formatDate(v.createdAt)}
                        </span>
                      </div>

                      {v.changelog && (
                        <p className="text-sm">{v.changelog}</p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {v.files && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {v.files.length} files
                          </span>
                        )}
                        <span>{formatSize(v.totalSize)}</span>
                        {v.createdByName && (
                          <span>by {v.createdByName}</span>
                        )}
                      </div>
                    </div>

                    {v.files && v.files.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          v.files?.forEach(file => window.open(file.url, "_blank"));
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DatasetVersionHistory;
