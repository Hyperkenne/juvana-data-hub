import { useState } from "react";
import DatasetManager from "@/components/datasets/DatasetManager";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DatasetUploadForm from "@/components/datasets/DatasetUploadForm";
import { Upload } from "lucide-react";

const Datasets = () => {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container py-12">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Datasets
            </h1>
            <p className="text-muted-foreground">
              Explore and share datasets for your machine learning projects
            </p>
          </div>
          
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Upload className="h-5 w-5" />
                Upload Dataset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Upload New Dataset</DialogTitle>
              </DialogHeader>
              <DatasetUploadForm onSuccess={() => setUploadOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <DatasetManager />
      </div>
    </div>
  );
};

export default Datasets;
