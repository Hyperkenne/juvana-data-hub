import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Trophy } from "lucide-react";
import { doc, getDoc, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Competition, LeaderboardEntry } from "@/types/competition";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SubmissionUpload } from "@/components/SubmissionUpload";
import { CompetitionDiscussions } from "@/components/CompetitionDiscussions";
import { CompetitionTeams } from "@/components/CompetitionTeams";

const CompetitionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchCompetition = async () => {
      try {
        const docRef = doc(db, "competitions", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setCompetition({
            id: docSnap.id,
            ...docSnap.data(),
            deadline: docSnap.data().deadline.toDate(),
          } as Competition);
        }
      } catch (error) {
        console.error("Error fetching competition:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompetition();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const q = query(
      collection(db, `competitions/${id}/leaderboard`),
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

  if (!competition) {
    return (
      <div className="container py-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Competition not found</h2>
        <Button asChild>
          <Link to="/competitions">Back to Competitions</Link>
        </Button>
      </div>
    );
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-accent";
    if (rank === 2) return "text-secondary";
    if (rank === 3) return "text-primary";
    return "";
  };

  return (
    <div className="container py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-secondary text-secondary-foreground">
            {competition.status}
          </Badge>
          <Badge variant="outline">{competition.category}</Badge>
        </div>
        
        <h1 className="text-4xl font-bold mb-4">{competition.title}</h1>
        
        <div className="flex flex-wrap gap-6 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            <span className="font-semibold text-accent">{competition.prize}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <span>Ends {new Date(competition.deadline).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>{competition.participants} participants</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leaderboard">
            <span className="flex items-center gap-2">
              Leaderboard
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs px-2 py-0">
                LIVE
              </Badge>
            </span>
          </TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="discussions">Discussions</TabsTrigger>
          <TabsTrigger value="submit">Submit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {competition.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evaluation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Submissions are evaluated based on accuracy score. Higher scores rank higher on the leaderboard.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                Live Leaderboard
                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Real-time Updates
                  </span>
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors border border-border/50"
                  >
                    <span className={`text-2xl font-bold w-12 ${getRankColor(entry.rank)}`}>
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
                    <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No submissions yet. Be the first!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams">
          <CompetitionTeams competitionId={id!} />
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
          ) : (
            <SubmissionUpload 
              competitionId={id!} 
              competition={competition}
              onSubmissionComplete={() => {}} 
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompetitionDetail;
