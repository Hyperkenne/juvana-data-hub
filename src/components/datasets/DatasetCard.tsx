import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Download, Database, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const DatasetCard = ({ dataset }: any) => {
  const formatSize = (bytes: number) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Recently";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <Link to={`/datasets/${dataset.id}`}>
      <Card className="hover:shadow-lg hover:border-primary/50 transition-all duration-300 h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <CardTitle className="text-lg line-clamp-2">{dataset.name}</CardTitle>
            {dataset.category && (
              <Badge variant="secondary" className="shrink-0">
                {dataset.category}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="h-5 w-5">
              <AvatarImage src={dataset.userAvatar} />
              <AvatarFallback>{dataset.userName?.[0] || "U"}</AvatarFallback>
            </Avatar>
            <span className="truncate">{dataset.userName || "Anonymous"}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {dataset.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {dataset.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              <span>{dataset.downloadCount || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              <span>v{dataset.latestVersion || 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(dataset.createdAt)}</span>
            </div>
          </div>

          {dataset.tags && dataset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dataset.tags.slice(0, 3).map((tag: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {dataset.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{dataset.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

export default DatasetCard;
