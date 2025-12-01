import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import DatasetVersionHistory from "@/components/datasets/DatasetVersionHistory";
import DatasetDiscussion from "@/components/datasets/DatasetDiscussion";

const DatasetDetail = () => {
  const { id } = useParams();
  const [dataset, setDataset] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const snap = await getDoc(doc(db, "datasets", id!));
    setDataset(snap.exists() ? snap.data() : null);
  };

  if (!dataset) return <p className="container py-12">Loading...</p>;

  return (
    <div className="container py-12 space-y-8">
      <h1 className="text-4xl font-bold">{dataset.name}</h1>

      <DatasetVersionHistory datasetId={id} />
      <DatasetDiscussion datasetId={id} />
    </div>
  );
};

export default DatasetDetail;
