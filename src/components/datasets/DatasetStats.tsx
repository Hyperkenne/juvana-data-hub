import { Card, CardContent } from "@/components/ui/card";
import { Download, Database, Calendar, User, FileText, Award } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DatasetStatsProps {
  dataset: any;
}

const DatasetStats = ({ dataset }: DatasetStatsProps) => {
  const formatSize = (bytes: number) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const stats = [
    { icon: Download, label: "Downloads", value: dataset.downloadCount || 0 },
    { icon: Database, label: "Version", value: `v${dataset.latestVersion || 1}` },
    { icon: Calendar, label: "Updated", value: formatDate(dataset.updatedAt || dataset.createdAt) },
    { icon: FileText, label: "Files", value: dataset.fileCount || "N/A" },
    { icon: Award, label: "License", value: dataset.license || "Not specified" },
    { icon: User, label: "Owner", value: dataset.userName || "Anonymous" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, idx) => (
        <Card key={idx}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <stat.icon className="h-4 w-4" />
              <span className="text-xs font-medium">{stat.label}</span>
            </div>
            <p className="text-lg font-semibold truncate">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DatasetStats;