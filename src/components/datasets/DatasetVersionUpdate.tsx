import { useState } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, GitBranch } from "lucide-react";

interface DatasetVersionUpdateProps {
  datasetId: string;
  currentVersion: number;
  onUpdate: () => void;
}

const DatasetVersionUpdate = ({ datasetId, currentVersion, onUpdate }: DatasetVersionUpdateProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    if (!files || files.length === 0) {
      toast({ title: "Error", description: "Please select files to upload", variant: "destructive" });
      return;
    }

    setLoading(true);
    const newVersion = currentVersion + 1;

    try {
      // Upload files to new version folder
      const uploadedFiles = [];
      let totalSize = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileRef = ref(storage, `datasets/${datasetId}/v${newVersion}/${file.name}`);
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
      await addDoc(collection(db, `datasets/${datasetId}/versions`), {
        version: newVersion,
        files: uploadedFiles,
        totalSize: totalSize,
        changelog: changelog || `Version ${newVersion}`,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: user.displayName || "Anonymous",
      });

      // Update dataset document
      await updateDoc(doc(db, "datasets", datasetId), {
        latestVersion: newVersion,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Version Updated",
        description: `Dataset updated to version ${newVersion}`,
      });

      setOpen(false);
      setChangelog("");
      setFiles(null);
      onUpdate();
    } catch (error: any) {
      console.error("Update error:", error);
      toast({
        title: "Update failed",
        description: error.message || "Failed to update dataset",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <GitBranch className="h-4 w-4" />
          New Version
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload New Version
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="text-muted-foreground">
              Current version: <span className="font-medium text-foreground">v{currentVersion}</span>
            </p>
            <p className="text-muted-foreground">
              New version: <span className="font-medium text-foreground">v{currentVersion + 1}</span>
            </p>
          </div>

          <div>
            <Label htmlFor="changelog">Changelog *</Label>
            <Textarea
              id="changelog"
              placeholder="Describe what changed in this version..."
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              rows={3}
              required
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
              Upload the complete updated dataset files
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload v{currentVersion + 1}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DatasetVersionUpdate;