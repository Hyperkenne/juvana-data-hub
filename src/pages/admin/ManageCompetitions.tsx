import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Competition } from "@/types/competition";
import { toast } from "sonner";

const ManageCompetitions = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async (): Promise<void> => {
    try {
      const q = query(collection(db, "competitions"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const comps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        deadline: doc.data().deadline.toDate(),
      })) as Competition[];
      setCompetitions(comps);
    } catch (error) {
      console.error("Error fetching competitions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm("Are you sure you want to delete this competition?")) return;

    try {
      await deleteDoc(doc(db, "competitions", id));
      toast.success("Competition deleted");
      fetchCompetitions();
    } catch (error) {
      console.error("Error deleting competition:", error);
      toast.error("Failed to delete competition");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">Manage Competitions</h2>
          <p className="text-muted-foreground">Create and manage data science challenges</p>
        </div>
        <Button asChild className="bg-gradient-to-r from-primary to-secondary">
          <Link to="/admin/competitions/create">
            <Plus className="mr-2 h-4 w-4" />
            New Competition
          </Link>
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {competitions.map((comp) => (
            <Card key={comp.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{comp.title}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={comp.status === "active" ? "default" : "secondary"}>
                        {comp.status}
                      </Badge>
                      <Badge variant="outline">{comp.category}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/competition/${comp.id}`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(comp.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Prize:</span>{" "}
                    <span className="font-semibold text-accent">{comp.prize}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Deadline:</span>{" "}
                    <span className="font-semibold">
                      {new Date(comp.deadline).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Participants:</span>{" "}
                    <span className="font-semibold">{comp.participants}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageCompetitions;
