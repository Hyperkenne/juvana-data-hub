import { Download, Database, FileText, Eye, HardDrive } from "lucide-react";

interface DatasetStatsProps {
  dataset: any;
}

const DatasetStats = ({ dataset }: DatasetStatsProps) => {
  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const stats = [
    { icon: Download, label: "Downloads", value: dataset.downloadCount || 0 },
    { icon: Eye, label: "Views", value: dataset.viewCount || 0 },
    { icon: FileText, label: "Files", value: dataset.fileCount || 1 },
    { icon: HardDrive, label: "Size", value: formatSize(dataset.totalSize) },
    { icon: Database, label: "Version", value: dataset.latestVersion || 1 },
  ];

  return (
    <div className="flex flex-wrap gap-6">
      {stats.map((stat, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <stat.icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{stat.label}:</span>
          <span className="font-medium">{stat.value}</span>
        </div>
      ))}
    </div>
  );
};

export default DatasetStats;