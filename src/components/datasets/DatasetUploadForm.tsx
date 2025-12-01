import { useState } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface DatasetUploadFormProps {
  onSuccess: () => void;
}

const DatasetUploadForm = ({ onSuccess }: DatasetUploadFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    tags: "",
    license: "CC0",
  });
  const [files, setFiles] = useState<FileList | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to upload datasets", variant: "destructive" });
      return;
    }

    if (!formData.name || !files || files.length === 0) {
      toast({ title: "Error", description: "Please provide a name and select files", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // Create dataset document first
      const datasetRef = await addDoc(collection(db, "datasets"), {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        license: formData.license,
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userAvatar: user.photoURL || "",
        downloadCount: 0,
        latestVersion: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Upload files
      const uploadedFiles = [];
      let totalSize = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileRef = ref(storage, `datasets/${datasetRef.id}/v1/${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
        uploadedFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          url: url,
        });
        totalSize += file.size;
      }

      // Create version document
      await addDoc(collection(db, `datasets/${datasetRef.id}/versions`), {
        version: 1,
        files: uploadedFiles,
        totalSize: totalSize,
        createdAt: serverTimestamp(),
      });

      toast({ 
        title: "Success!", 
        description: "Dataset uploaded successfully. It's now available to the community.",
        duration: 5000,
      });

      onSuccess();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ 
        title: "Upload failed", 
        description: error.message || "Failed to upload dataset",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Dataset Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Housing Prices Dataset"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your dataset, its contents, and potential use cases..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            placeholder="e.g., Healthcare, Finance, NLP"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="license">License</Label>
          <select
            id="license"
            value={formData.license}
            onChange={(e) => setFormData({ ...formData, license: e.target.value })}
            className="w-full h-10 px-3 rounded-md border border-input bg-background"
          >
            <option value="CC0">CC0 (Public Domain)</option>
            <option value="CC-BY">CC-BY</option>
            <option value="CC-BY-SA">CC-BY-SA</option>
            <option value="MIT">MIT</option>
            <option value="Apache-2.0">Apache 2.0</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          placeholder="e.g., classification, time-series, images"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="files">Files *</Label>
        <Input
          id="files"
          type="file"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          Upload CSV, JSON, images, or other data files
        </p>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          "Upload Dataset"
        )}
      </Button>
    </form>
  );
};

export default DatasetUploadForm;