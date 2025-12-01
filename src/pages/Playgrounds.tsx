import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Users, Lock, Plus } from "lucide-react";
import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Playground {
  id: string;
  title: string;
  description: string;
  category: string;
  deadline: Date;
  creatorId: string;
  creatorName: string;
  participants: number;
  visibility: "private" | "community";
  inviteCode?: string;
  prize?: string;
}

const Playgrounds = () => {
  const { user } = useAuth();
  const [playgrounds, setPlaygrounds] = useState<Playground[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    deadline: "",
    visibility: "community",
    prize: "",
  });

  useEffect(() => {
    fetchPlaygrounds();
  }, [user]);

  const fetchPlaygrounds = async () => {
    try {
      const q = query(collection(db, "playgrounds"));
      const snapshot = await getDocs(q);
      const plays = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        deadline: doc.data().deadline.toDate(),
      })) as Playground[];
      setPlaygrounds(plays);
    } catch (error) {
      console.error("Error fetching playgrounds:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlayground = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to create a playground");
      return;
    }

    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await addDoc(collection(db, "playgrounds"), {
        ...formData,
        deadline: new Date(formData.deadline),
        creatorId: user.uid,
        creatorName: user.displayName || "Anonymous",
        participants: 0,
        inviteCode,
        createdAt: serverTimestamp(),
      });
      
      toast.success(`Playground created! Invite code: ${inviteCode}`);
      setIsCreateOpen(false);
      setFormData({
        title: "",
        description: "",
        category: "",
        deadline: "",
        visibility: "community",
        prize: "",
      });
      fetchPlaygrounds();
    } catch (error) {
      console.error("Error creating playground:", error);
      toast.error("Failed to create playground");
    }
  };

  if (loading) {
    return (
      <div className="container py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-full" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-4">Playground Competitions</h1>
          <p className="text-muted-foreground text-lg">
            Private competitions for classes, friends, and small communities
          </p>
        </div>
        
        {user && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-gradient-to-r from-primary to-primary-glow">
                <Plus className="h-5 w-5 mr-2" />
                Create Playground
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Playground</DialogTitle>
                <DialogDescription>
                  Set up a private competition for your class or community
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreatePlayground} className="space-y-4">
                <div>
                  <Label htmlFor="title">Competition Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., CS101 Final Project Challenge"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the competition goals and rules..."
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., Machine Learning"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      type="datetime-local"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="visibility">Visibility</Label>
                    <Select
                      value={formData.visibility}
                      onValueChange={(value) => setFormData({ ...formData, visibility: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private (Invite Only)</SelectItem>
                        <SelectItem value="community">Community (Public)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="prize">Prize (Optional)</Label>
                    <Input
                      id="prize"
                      value={formData.prize}
                      onChange={(e) => setFormData({ ...formData, prize: e.target.value })}
                      placeholder="e.g., Certificate, Bonus Points"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Playground</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {playgrounds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg mb-4">
              No playgrounds yet. Create the first one!
            </p>
            {!user && (
              <p className="text-sm text-muted-foreground">
                Sign in to create or join playground competitions
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playgrounds.map((playground) => (
            <Card key={playground.id} className="hover:shadow-lg transition-all border-border/50 flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant={playground.visibility === "private" ? "secondary" : "default"}>
                    <Lock className="h-3 w-3 mr-1" />
                    {playground.visibility}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {playground.category}
                  </Badge>
                </div>
                <CardTitle className="line-clamp-2">{playground.title}</CardTitle>
                <CardDescription className="line-clamp-3">
                  {playground.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-grow">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Created by {playground.creatorName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Ends {new Date(playground.deadline).toLocaleDateString()}</span>
                  </div>
                  {playground.prize && (
                    <div className="flex items-center gap-2 text-sm text-accent font-semibold">
                      🏆 {playground.prize}
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                <Button asChild className="w-full">
                  <Link to={`/playground/${playground.id}`}>View Competition</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Playgrounds;
