import { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import DatasetCard from "./DatasetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const DatasetManager = () => {
  const [datasets, setDatasets] = useState([]);
  const [datasetName, setDatasetName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    const snap = await getDocs(collection(db, "datasets"));
    setDatasets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const uploadDataset = async () => {
    if (!datasetName || !file) {
      toast({ title: "Error", description: "Enter a name and select a file." });
      return;
    }

    const datasetRef = ref(storage, `datasets/${datasetName}/v1.zip`);
    await uploadBytes(datasetRef, file);
    const url = await getDownloadURL(datasetRef);

    const docRef = await addDoc(collection(db, "datasets"), {
      name: datasetName,
      createdAt: serverTimestamp(),
      latestVersion: 1,
    });

    await addDoc(collection(db, `datasets/${docRef.id}/versions`), {
      version: 1,
      fileUrl: url,
      createdAt: serverTimestamp(),
    });

    toast({ title: "Uploaded", description: "Dataset uploaded successfully." });
    setDatasetName("");
    setFile(null);
    loadDatasets();
  };

  return (
    <div>
      <div className="border p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload a Dataset</h2>

        <Input
          placeholder="Dataset Name"
          value={datasetName}
          onChange={(e) => setDatasetName(e.target.value)}
          className="mb-4"
        />

        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mb-4" />

        <Button onClick={uploadDataset}>Upload Dataset</Button>
      </div>

      <h2 className="text-xl font-semibold mb-4">Available Datasets</h2>

      <div className="grid md:grid-cols-3 gap-4">
        {datasets.map((d) => (
          <DatasetCard key={d.id} dataset={d} />
        ))}
      </div>
    </div>
  );
};

export default DatasetManager;
