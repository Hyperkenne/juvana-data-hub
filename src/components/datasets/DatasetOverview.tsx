import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow, format } from "date-fns";
import { FileText, Calendar, Scale, Tag, User } from "lucide-react";

interface DatasetOverviewProps {
  dataset: any;
}

const DatasetOverview = ({ dataset }: DatasetOverviewProps) => {
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "MMMM d, yyyy");
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* About Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            About Dataset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dataset.description ? (
            <p className="text-muted-foreground leading-relaxed">
              {dataset.description}
            </p>
          ) : (
            <p className="text-muted-foreground italic">No description provided</p>
          )}
        </CardContent>
      </Card>

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <Scale className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">License</p>
                <p className="text-muted-foreground">{dataset.license || "Not specified"}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-muted-foreground">{formatDate(dataset.createdAt)}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Owner</p>
                <p className="text-muted-foreground">{dataset.userName || "Anonymous"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Category</p>
              {dataset.category ? (
                <Badge variant="secondary">{dataset.category}</Badge>
              ) : (
                <span className="text-muted-foreground text-sm">Uncategorized</span>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </p>
              {dataset.tags && dataset.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {dataset.tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">No tags</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Download the data</h4>
            <p className="text-sm text-muted-foreground">
              Click the "Download" button to get all dataset files as a ZIP archive.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <h4 className="font-medium">2. Use the starter notebook</h4>
            <p className="text-sm text-muted-foreground">
              Download the starter notebook or copy the code to quickly begin your analysis.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <h4 className="font-medium">3. Share your work</h4>
            <p className="text-sm text-muted-foreground">
              Create a notebook and share your analysis with the community.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatasetOverview;
