import { Download, Database, FileText, Eye, HardDrive } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

interface DatasetStatsProps {
  dataset: any;
}

const DatasetStats = ({ dataset }: DatasetStatsProps) => {
  const [versionStats, setVersionStats] = useState({ fileCount: 0, totalSize: 0 });

  useEffect(() => {
    const loadVersionStats = async () => {
      if (!dataset?.id) return;
      try {
        const q = query(
          collection(db, `datasets/${dataset.id}/versions`),
          orderBy("version", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setVersionStats({
            fileCount: data.files?.length || 0,
            totalSize: data.totalSize || 0
          });
        }
      } catch (error) {
        console.error("Error loading version stats:", error);
      }
    };
    loadVersionStats();
  }, [dataset?.id]);

  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const stats = [
    { icon: Download, label: "Downloads", value: dataset.downloadCount?.toLocaleString() || "0" },
    { icon: Eye, label: "Views", value: dataset.viewCount?.toLocaleString() || "0" },
    { icon: FileText, label: "Files", value: versionStats.fileCount || dataset.fileCount || "—" },
    { icon: HardDrive, label: "Size", value: formatSize(versionStats.totalSize || dataset.totalSize) },
    { icon: Database, label: "Version", value: `v${dataset.latestVersion || 1}` },
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