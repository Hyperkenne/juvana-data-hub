import { useState, useRef } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FolderUp, FileUp, X, FileArchive } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DatasetUploadFormProps {
  onSuccess: () => void;
}

const DatasetUploadForm = ({ onSuccess }: DatasetUploadFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subtitle: "", // Short description 15-20 words
    description: "", // Detailed about section
    category: "",
    tags: "",
    license: "CC0",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [uploadMode, setUploadMode] = useState<"files" | "folder">("files");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const MAX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024; // 50MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTotalSize = () => files.reduce((sum, f) => sum + f.size, 0);

  const isCompressedFile = (file: File) => {
    const compressedExtensions = ['.zip', '.gz', '.tar', '.rar', '.7z', '.bz2'];
    return compressedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const validateFiles = () => {
    const totalSize = getTotalSize();
    const hasLargeUncompressed = files.some(f => f.size > MAX_UNCOMPRESSED_SIZE && !isCompressedFile(f));
    
    if (hasLargeUncompressed) {
      toast({
        title: "Large file detected",
        description: "Files over 50MB must be compressed (zip, gz, tar). Please compress large files before uploading.",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to upload datasets", variant: "destructive" });
      return;
    }

    if (!formData.name || files.length === 0) {
      toast({ title: "Error", description: "Please provide a name and select files", variant: "destructive" });
      return;
    }

    if (!validateFiles()) return;

    setLoading(true);

    try {
      // Create dataset document first
      const datasetRef = await addDoc(collection(db, "datasets"), {
        name: formData.name,
        subtitle: formData.subtitle,
        description: formData.description,
        category: formData.category,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        license: formData.license,
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userAvatar: user.photoURL || "",
        downloadCount: 0,
        viewCount: 0,
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
        fileCount: uploadedFiles.length,
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
          placeholder="e.g., Tanzania Housing Prices 2024"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="subtitle">Short Description * <span className="text-muted-foreground text-xs">(15-20 words)</span></Label>
        <Input
          id="subtitle"
          placeholder="A brief summary of what this dataset contains..."
          value={formData.subtitle}
          onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
          maxLength={150}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          {formData.subtitle.split(/\s+/).filter(Boolean).length}/20 words
        </p>
      </div>

      <div>
        <Label htmlFor="description">About Dataset <span className="text-muted-foreground text-xs">(detailed)</span></Label>
        <Textarea
          id="description"
          placeholder="Describe how the data was collected, what it contains, potential use cases, methodology, sources, etc..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={6}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Include: data collection method, features, use cases, and any relevant context
        </p>
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

      {/* File Upload Section */}
      <div className="space-y-3">
        <Label>Files *</Label>
        
        {/* Upload mode toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={uploadMode === "files" ? "default" : "outline"}
            size="sm"
            onClick={() => setUploadMode("files")}
            className="gap-2"
          >
            <FileUp className="h-4 w-4" />
            Upload Files
          </Button>
          <Button
            type="button"
            variant={uploadMode === "folder" ? "default" : "outline"}
            size="sm"
            onClick={() => setUploadMode("folder")}
            className="gap-2"
          >
            <FolderUp className="h-4 w-4" />
            Upload Folder
          </Button>
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore - webkitdirectory is not in types
          webkitdirectory=""
          // @ts-ignore
          directory=""
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Drop zone */}
        <div
          onClick={() => uploadMode === "files" ? fileInputRef.current?.click() : folderInputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition"
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">
            Click to {uploadMode === "files" ? "select files" : "select a folder"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            CSV, JSON, images, or other data files
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-amber-600">
            <FileArchive className="h-3 w-3" />
            <span>Files over 50MB must be compressed (zip, gz, tar)</span>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{files.length} file(s) selected</span>
              <Badge variant="secondary">{formatSize(getTotalSize())}</Badge>
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isCompressedFile(file) ? (
                      <FileArchive className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{file.name}</span>
                    <span className="text-muted-foreground shrink-0">({formatSize(file.size)})</span>
                    {file.size > MAX_UNCOMPRESSED_SIZE && !isCompressedFile(file) && (
                      <Badge variant="destructive" className="text-xs">Too large</Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
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
