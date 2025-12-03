import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Scale, Tag, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DatasetAboutProps {
  dataset: any;
}

const DatasetAbout = ({ dataset }: DatasetAboutProps) => {
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <div className="space-y-6">
      {/* About Section - Detailed description */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            About Dataset
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          {dataset.description ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {dataset.description}
            </div>
          ) : (
            <p className="text-muted-foreground italic">No detailed description provided.</p>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Owner</p>
                <p className="font-medium">{dataset.userName || "Anonymous"}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">Created</p>
                <p className="font-medium">{formatDate(dataset.createdAt)}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Scale className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-xs">License</p>
                <p className="font-medium">{dataset.license || "Not specified"}</p>
              </div>
            </div>
            
            {dataset.category && (
              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Category</p>
                  <p className="font-medium">{dataset.category}</p>
                </div>
              </div>
            )}
          </div>

          {dataset.tags && dataset.tags.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {dataset.tags.map((tag: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DatasetAbout;
