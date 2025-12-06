import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Lock, Copy, Trophy, FileText, AlertCircle, School, Building2 } from "lucide-react";
import { doc, getDoc, collection, query, orderBy, onSnapshot, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SubmissionUpload } from "@/components/SubmissionUpload";
import { CompetitionDiscussions } from "@/components/CompetitionDiscussions";
import { CompetitionData } from "@/components/competitions/CompetitionData";
import { toast } from "sonner";

interface Playground {
  id: string;
  title: string;
  description: string;
  rules?: string;
  category: string;
  deadline: Date;
  creatorId: string;
  creatorName: string;
  participants: number;
  members?: string[];
  visibility: "private" | "community";
  inviteCode?: string;
  prize?: string;
  organization?: string;
  organizationType?: string;
  datasetId?: string;
  // Dataset configuration
  trainUrl?: string;
  testUrl?: string;
  groundTruthPath?: string;
  trainRows?: number;
  testRows?: number;
  idColumn?: string;
  targetColumn?: string;
  scoringMethod?: string;
  maxSubmissionsPerDay?: number;
}

interface LeaderboardEntry {
  id: string;
  rank: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  score: number;
  submissions: number;
  lastSubmission: Date;
}

const PlaygroundDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [playground, setPlayground] = useState<Playground | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchPlayground = async () => {
      try {
        const docRef = doc(db, "playgrounds", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPlayground({
            id: docSnap.id,
            ...data,
            deadline: data.deadline.toDate(),
          } as Playground);
          
          // Check if user is a member
          if (user && data.members?.includes(user.uid)) {
            setIsMember(true);
          }
        }
      } catch (error) {
        console.error("Error fetching playground:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayground();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;

    const q = query(
      collection(db, `playgrounds/${id}/leaderboard`),
      orderBy("score", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        rank: index + 1,
        ...doc.data(),
        lastSubmission: doc.data().lastSubmission?.toDate(),
      })) as LeaderboardEntry[];
      
      setLeaderboard(entries);
    });

    return () => unsubscribe();
  }, [id]);

  const copyInviteCode = () => {
    if (playground?.inviteCode) {
      navigator.clipboard.writeText(playground.inviteCode);
      toast.success("Invite code copied to clipboard!");
    }
  };

  const handleJoinPlayground = async () => {
    if (!user || !playground) return;

    try {
      await updateDoc(doc(db, "playgrounds", playground.id), {
        members: arrayUnion(user.uid),
        participants: increment(1),
      });
      setIsMember(true);
      toast.success("You've joined the playground!");
    } catch (error) {
      console.error("Error joining playground:", error);
      toast.error("Failed to join playground");
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const daysRemaining = playground 
    ? Math.ceil((new Date(playground.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  if (loading) {
    return (
      <div className="container py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-muted rounded w-2/3" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!playground) {
    return (
      <div className="container py-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Playground not found</h2>
        <Button asChild>
          <Link to="/playgrounds">Back to Playgrounds</Link>
        </Button>
      </div>
    );
  }

  // Check access for private playgrounds
  const canAccess = playground.visibility === "community" || isMember || playground.creatorId === user?.uid;

  return (
    <div className="container py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant={playground.visibility === "private" ? "secondary" : "default"}>
            <Lock className="h-3 w-3 mr-1" />
            {playground.visibility}
          </Badge>
          <Badge variant="outline">{playground.category}</Badge>
          {playground.organization && (
            <Badge variant="outline" className="flex items-center gap-1">
              {playground.organizationType === "university" ? (
                <School className="h-3 w-3" />
              ) : (
                <Building2 className="h-3 w-3" />
              )}
              {playground.organization}
            </Badge>
          )}
        </div>
        
        <h1 className="text-4xl font-bold mb-4">{playground.title}</h1>
        
        <div className="flex flex-wrap gap-6 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>Created by {playground.creatorName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <span>Ends {new Date(playground.deadline).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>{playground.participants} participants</span>
          </div>
          {playground.prize && (
            <div className="flex items-center gap-2 text-accent font-semibold">
              <Trophy className="h-5 w-5" />
              {playground.prize}
            </div>
          )}
        </div>

        {/* Invite Code Section for Owners */}
        {playground.visibility === "private" && playground.inviteCode && playground.creatorId === user?.uid && (
          <Card className="mt-6 bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold mb-1">Invite Code (share with participants)</p>
                  <p className="text-2xl font-mono font-bold text-primary">{playground.inviteCode}</p>
                </div>
                <Button onClick={copyInviteCode} variant="outline" size="sm">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Join Button for Non-Members */}
        {user && !isMember && playground.visibility === "community" && (
          <Button onClick={handleJoinPlayground} className="mt-6">
            Join Playground
          </Button>
        )}
      </div>

      {!canAccess ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              This is a private playground. You need an invite code to join.
            </p>
            <Button asChild variant="outline">
              <Link to="/playgrounds">Back to Playgrounds</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="discussions">Discussions</TabsTrigger>
            <TabsTrigger value="submit">Submit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <p className="font-semibold">{formatDate(playground.deadline)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Time Remaining</p>
                    <Badge variant={daysRemaining <= 7 ? "destructive" : "secondary"}>
                      {daysRemaining > 0 ? `${daysRemaining} days left` : "Competition ended"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {playground.description}
                </p>
              </CardContent>
            </Card>

            {/* Rules */}
            {playground.rules && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Rules & Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {playground.rules}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="data">
            <CompetitionData 
              competitionId={id!} 
              datasetId={playground.datasetId}
              trainUrl={playground.trainUrl}
              testUrl={playground.testUrl}
            />
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors border border-border/50"
                    >
                      <span className="text-2xl font-bold w-12 text-primary">
                        #{entry.rank}
                      </span>
                      
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={entry.userAvatar} alt={entry.userName} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {entry.userName[0]}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-grow">
                        <p className="font-semibold">{entry.userName}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.submissions} submission{entry.submissions !== 1 ? "s" : ""}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          {entry.score.toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.lastSubmission).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {leaderboard.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No submissions yet. Be the first!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discussions">
            <CompetitionDiscussions competitionId={id!} />
          </TabsContent>

          <TabsContent value="submit">
            {!user ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    Please sign in to submit your solution
                  </p>
                  <Button asChild>
                    <Link to="/">Sign In</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : !isMember && playground.visibility === "private" ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    You must join this playground to submit
                  </p>
                </CardContent>
              </Card>
            ) : (
              <SubmissionUpload 
                competitionId={id!} 
                competitionType="playground"
                competition={{
                  groundTruthPath: playground.groundTruthPath,
                  testRows: playground.testRows,
                  idColumn: playground.idColumn || "id",
                  targetColumn: playground.targetColumn || "prediction",
                  scoringMethod: playground.scoringMethod || "accuracy",
                  maxSubmissionsPerDay: playground.maxSubmissionsPerDay || 5,
                }}
                onSubmissionComplete={() => {}} 
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default PlaygroundDetail;
