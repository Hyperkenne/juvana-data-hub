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
import { Calendar, Users, Lock, Plus, Key, Loader2, School, Building2, Database, CheckCircle } from "lucide-react";
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CompetitionDatasetUpload } from "@/components/competitions/CompetitionDatasetUpload";

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

interface DatasetInfo {
  trainUrl: string;
  testUrl: string;
  groundTruthPath: string;
  trainRows: number;
  testRows: number;
  idColumn: string;
  targetColumn: string;
}

const Playgrounds = () => {
  const { user } = useAuth();
  const [playgrounds, setPlaygrounds] = useState<Playground[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    rules: "",
    category: "",
    deadline: "",
    visibility: "community",
    prize: "",
    organization: "",
    organizationType: "university",
    scoringMethod: "accuracy",
    maxSubmissionsPerDay: "5",
  });
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [creationStep, setCreationStep] = useState<1 | 2>(1);

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

    if (!datasetInfo) {
      toast.error("Please upload competition dataset first");
      return;
    }

    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await addDoc(collection(db, "playgrounds"), {
        title: formData.title,
        description: formData.description,
        rules: formData.rules,
        category: formData.category,
        visibility: formData.visibility,
        prize: formData.prize,
        organization: formData.organization,
        organizationType: formData.organizationType,
        deadline: new Date(formData.deadline),
        creatorId: user.uid,
        creatorName: user.displayName || "Anonymous",
        participants: 1,
        members: [user.uid],
        inviteCode,
        createdAt: serverTimestamp(),
        // Dataset configuration
        trainUrl: datasetInfo.trainUrl,
        testUrl: datasetInfo.testUrl,
        groundTruthPath: datasetInfo.groundTruthPath,
        trainRows: datasetInfo.trainRows,
        testRows: datasetInfo.testRows,
        idColumn: datasetInfo.idColumn,
        targetColumn: datasetInfo.targetColumn,
        scoringMethod: formData.scoringMethod,
        maxSubmissionsPerDay: parseInt(formData.maxSubmissionsPerDay) || 5,
      });
      
      toast.success(`Playground created! Invite code: ${inviteCode}`);
      setIsCreateOpen(false);
      setFormData({
        title: "",
        description: "",
        rules: "",
        category: "",
        deadline: "",
        visibility: "community",
        prize: "",
        organization: "",
        organizationType: "university",
        scoringMethod: "accuracy",
        maxSubmissionsPerDay: "5",
      });
      setDatasetInfo(null);
      setCreationStep(1);
      fetchPlaygrounds();
    } catch (error) {
      console.error("Error creating playground:", error);
      toast.error("Failed to create playground");
    }
  };

  const handleJoinWithCode = async () => {
    if (!user || !joinCode.trim()) return;
    
    setIsJoining(true);
    try {
      const q = query(
        collection(db, "playgrounds"),
        where("inviteCode", "==", joinCode.toUpperCase().trim())
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        toast.error("Invalid invite code");
        return;
      }

      const playgroundDoc = snapshot.docs[0];
      const playgroundData = playgroundDoc.data();
      
      if (playgroundData.members?.includes(user.uid)) {
        toast.info("You're already a member of this playground");
        return;
      }

      await updateDoc(doc(db, "playgrounds", playgroundDoc.id), {
        members: arrayUnion(user.uid),
        participants: increment(1),
      });

      toast.success(`Joined "${playgroundData.title}" successfully!`);
      setJoinCode("");
      fetchPlaygrounds();
    } catch (error) {
      console.error("Error joining playground:", error);
      toast.error("Failed to join playground");
    } finally {
      setIsJoining(false);
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Playground</DialogTitle>
                <DialogDescription>
                  Step {creationStep} of 2: {creationStep === 1 ? "Competition Details" : "Upload Dataset"}
                </DialogDescription>
              </DialogHeader>
              
              {/* Step Indicators */}
              <div className="flex items-center gap-4 mb-4">
                <div className={`flex items-center gap-2 ${creationStep >= 1 ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${creationStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {creationStep > 1 ? <CheckCircle className="h-4 w-4" /> : "1"}
                  </div>
                  <span className="text-sm">Details</span>
                </div>
                <div className="flex-1 h-px bg-border" />
                <div className={`flex items-center gap-2 ${creationStep >= 2 ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${creationStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {datasetInfo ? <CheckCircle className="h-4 w-4" /> : "2"}
                  </div>
                  <span className="text-sm">Dataset</span>
                </div>
              </div>

              {creationStep === 1 ? (
                <div className="space-y-4">
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
                      placeholder="Describe the competition goals..."
                      rows={3}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="rules">Rules & Instructions</Label>
                    <Textarea
                      id="rules"
                      value={formData.rules}
                      onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                      placeholder="Competition rules, submission guidelines, evaluation criteria..."
                      rows={4}
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="scoringMethod">Scoring Method</Label>
                      <Select
                        value={formData.scoringMethod}
                        onValueChange={(value) => setFormData({ ...formData, scoringMethod: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accuracy">Accuracy (Classification)</SelectItem>
                          <SelectItem value="f1">F1 Score (Binary Classification)</SelectItem>
                          <SelectItem value="rmse">RMSE (Regression)</SelectItem>
                          <SelectItem value="mae">MAE (Regression)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="maxSubmissions">Max Daily Submissions</Label>
                      <Input
                        id="maxSubmissions"
                        type="number"
                        min="1"
                        max="100"
                        value={formData.maxSubmissionsPerDay}
                        onChange={(e) => setFormData({ ...formData, maxSubmissionsPerDay: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Organization Section for Private Playgrounds */}
                  {formData.visibility === "private" && (
                    <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <School className="h-4 w-4" />
                        Organization Details (for private groups)
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="organizationType">Organization Type</Label>
                          <Select
                            value={formData.organizationType}
                            onValueChange={(value) => setFormData({ ...formData, organizationType: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="university">University</SelectItem>
                              <SelectItem value="school">School</SelectItem>
                              <SelectItem value="company">Company</SelectItem>
                              <SelectItem value="group">Private Group</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="organization">Organization Name</Label>
                          <Input
                            id="organization"
                            value={formData.organization}
                            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                            placeholder="e.g., University of Dar es Salaam"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      onClick={() => {
                        if (!formData.title || !formData.description || !formData.category || !formData.deadline) {
                          toast.error("Please fill in all required fields");
                          return;
                        }
                        setCreationStep(2);
                      }}
                    >
                      Next: Upload Dataset
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {datasetInfo ? (
                    <div className="border rounded-lg p-4 bg-green-500/10 border-green-500/50">
                      <div className="flex items-center gap-2 text-green-600 mb-2">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-semibold">Dataset Uploaded Successfully</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <span>Train rows: {datasetInfo.trainRows}</span>
                        <span>Test rows: {datasetInfo.testRows}</span>
                        <span>ID column: {datasetInfo.idColumn}</span>
                        <span>Target column: {datasetInfo.targetColumn}</span>
                      </div>
                    </div>
                  ) : (
                    <CompetitionDatasetUpload
                      competitionType="playground"
                      onUploadComplete={(data) => setDatasetInfo(data)}
                    />
                  )}

                  <div className="flex justify-between gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setCreationStep(1)}>
                      Back
                    </Button>
                    <Button 
                      onClick={handleCreatePlayground}
                      disabled={!datasetInfo}
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Create Playground
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Join with Code Section */}
      {user && (
        <Card className="mb-8 border-dashed">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Key className="h-5 w-5" />
                <span>Have an invite code?</span>
              </div>
              <Input
                placeholder="Enter invite code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="max-w-[200px] uppercase"
              />
              <Button onClick={handleJoinWithCode} disabled={!joinCode.trim() || isJoining}>
                {isJoining ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Join
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
