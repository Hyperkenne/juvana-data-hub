import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import DatasetStats from "@/components/datasets/DatasetStats";
import DatasetFileExplorer from "@/components/datasets/DatasetFileExplorer";
import DatasetVersionHistory from "@/components/datasets/DatasetVersionHistory";
import DatasetDiscussion from "@/components/datasets/DatasetDiscussion";
import { Download, Trash2, BookOpen, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const DatasetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [dataset, setDataset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      const snap = await getDoc(doc(db, "datasets", id!));
      if (snap.exists()) {
        setDataset({ id: snap.id, ...snap.data() });
      } else {
        toast({ title: "Not found", description: "Dataset not found", variant: "destructive" });
        navigate("/datasets");
      }
    } catch (error) {
      console.error("Error loading dataset:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || user.uid !== dataset.userId) {
      toast({ title: "Unauthorized", description: "You can only delete your own datasets", variant: "destructive" });
      return;
    }

    setDeleting(true);
    try {
      await deleteDoc(doc(db, "datasets", id!));
      toast({ title: "Deleted", description: "Dataset deleted successfully" });
      navigate("/datasets");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({ title: "Error", description: error.message || "Failed to delete dataset", variant: "destructive" });
      setDeleting(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  if (loading) {
    return (
      <div className="container py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dataset) return null;

  const isOwner = user && user.uid === dataset.userId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container py-12 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-4xl font-bold">{dataset.name}</h1>
                {dataset.category && (
                  <Badge variant="secondary" className="text-sm">
                    {dataset.category}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3 text-muted-foreground">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={dataset.userAvatar} />
                  <AvatarFallback>{dataset.userName?.[0] || "U"}</AvatarFallback>
                </Avatar>
                <span>{dataset.userName || "Anonymous"}</span>
                <span>•</span>
                <span>Updated {formatDate(dataset.updatedAt || dataset.createdAt)}</span>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <Button variant="default" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
              
              {isOwner && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" disabled={deleting}>
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Dataset?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this dataset and all its versions. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {dataset.description && (
            <p className="text-lg text-muted-foreground">{dataset.description}</p>
          )}

          {dataset.tags && dataset.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {dataset.tags.map((tag: string, idx: number) => (
                <Badge key={idx} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <DatasetStats dataset={dataset} />

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="discussion">Discussion</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <DatasetFileExplorer datasetId={id!} />
            
            <div className="border rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold">About this Dataset</h2>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>License:</strong> {dataset.license || "Not specified"}</p>
                <p><strong>Created:</strong> {formatDate(dataset.createdAt)}</p>
                {dataset.description && <p className="mt-4">{dataset.description}</p>}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data">
            <DatasetFileExplorer datasetId={id!} />
          </TabsContent>

          <TabsContent value="versions">
            <DatasetVersionHistory datasetId={id!} />
          </TabsContent>

          <TabsContent value="discussion">
            <DatasetDiscussion datasetId={id!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DatasetDetail;
