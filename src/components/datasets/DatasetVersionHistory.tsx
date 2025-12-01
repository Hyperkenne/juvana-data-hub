import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";

const DatasetVersionHistory = ({ datasetId }: any) => {
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const snap = await getDocs(collection(db, `datasets/${datasetId}/versions`));
    setVersions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  return (
    <div className="border p-6 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Version History</h2>

      {versions.map((v) => (
        <div key={v.id} className="flex justify-between mb-3 p-2 border rounded">
          <span>Version {v.version}</span>
          <Button asChild><a href={v.fileUrl} download>Download</a></Button>
        </div>
      ))}
    </div>
  );
};

export default DatasetVersionHistory;
