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
import DatasetNotebook from "@/components/datasets/DatasetNotebook";
import DatasetOverview from "@/components/datasets/DatasetOverview";
import { Download, Trash2, Loader2, Eye, Database, Code, MessageSquare, History } from "lucide-react";
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
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dataset) return null;

  const isOwner = user && user.uid === dataset.userId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header Section - Kaggle Style */}
      <div className="border-b bg-card/50">
        <div className="container py-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold">{dataset.name}</h1>
                {dataset.category && (
                  <Badge variant="secondary">{dataset.category}</Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={dataset.userAvatar} />
                    <AvatarFallback className="text-xs">{dataset.userName?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{dataset.userName || "Anonymous"}</span>
                </div>
                <span>•</span>
                <span>Updated {formatDate(dataset.updatedAt || dataset.createdAt)}</span>
                <span>•</span>
                <span>{dataset.downloadCount || 0} downloads</span>
              </div>

              {/* Short description - max 2 lines */}
              {dataset.description && (
                <p className="text-muted-foreground line-clamp-2 max-w-3xl">
                  {dataset.description}
                </p>
              )}

              {/* Tags */}
              {dataset.tags && dataset.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dataset.tags.slice(0, 5).map((tag: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {dataset.tags.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{dataset.tags.length - 5} more
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              <Button className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
              
              {isOwner && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" disabled={deleting}>
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
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b bg-muted/30">
        <div className="container py-4">
          <DatasetStats dataset={dataset} />
        </div>
      </div>

      {/* Main Content - Kaggle Style Tabs */}
      <div className="container py-6">
        <Tabs defaultValue="data" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="data" className="gap-2">
              <Database className="h-4 w-4" />
              Data
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-2">
              <Code className="h-4 w-4" />
              Code
            </TabsTrigger>
            <TabsTrigger value="discussion" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Discussion
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <History className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <DatasetFileExplorer datasetId={id!} />
              </div>
              <div>
                <DatasetOverview dataset={dataset} />
              </div>
            </div>
          </TabsContent>

          {/* Code Tab - Kaggle Style Notebook */}
          <TabsContent value="code" className="space-y-6">
            <DatasetNotebook 
              datasetId={id!} 
              datasetName={dataset.name}
              description={dataset.description}
            />
          </TabsContent>

          {/* Discussion Tab */}
          <TabsContent value="discussion">
            <DatasetDiscussion datasetId={id!} />
          </TabsContent>

          {/* Activity/Versions Tab */}
          <TabsContent value="activity">
            <DatasetVersionHistory datasetId={id!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DatasetDetail;
