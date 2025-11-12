import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Download, FileText, TrendingUp, Calendar, Award } from "lucide-react";
import { format } from "date-fns";

interface Submission {
  id: string;
  competitionId: string;
  competitionTitle?: string;
  score: number;
  fileName: string;
  fileUrl: string;
  rowCount: number;
  submittedAt: Date;
  status: string;
}

const SubmissionHistory = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    bestScore: 0,
    averageScore: 0,
  });

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  const fetchSubmissions = async (): Promise<void> => {
    if (!user) return;

    try {
      // Fetch competitions first to get titles
      const competitionsSnapshot = await getDocs(collection(db, "competitions"));
      const competitionsMap = new Map();
      competitionsSnapshot.docs.forEach((doc) => {
        competitionsMap.set(doc.id, doc.data().title);
      });

      // Fetch all submissions for the user across all competitions
      const allSubmissions: Submission[] = [];
      
      for (const [competitionId, title] of competitionsMap) {
        const q = query(
          collection(db, `competitions/${competitionId}/submissions`),
          where("userId", "==", user.uid),
          orderBy("submittedAt", "desc")
        );
        
        const snapshot = await getDocs(q);
        const compSubmissions = snapshot.docs.map((doc) => ({
          id: doc.id,
          competitionId,
          competitionTitle: title as string,
          ...doc.data(),
          submittedAt: doc.data().submittedAt?.toDate() || new Date(),
        })) as Submission[];
        
        allSubmissions.push(...compSubmissions);
      }

      // Sort all submissions by date
      allSubmissions.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      
      setSubmissions(allSubmissions);

      // Calculate stats
      if (allSubmissions.length > 0) {
        const scores = allSubmissions.map((s) => s.score);
        setStats({
          totalSubmissions: allSubmissions.length,
          bestScore: Math.max(...scores),
          averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        });
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container py-12">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Please sign in to view your submission history.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Submission History
        </h1>
        <p className="text-muted-foreground">Track all your competition submissions and scores</p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Award className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Best Score</p>
                <p className="text-2xl font-bold">{stats.bestScore.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{stats.averageScore.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions List */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading submissions...</p>
          </CardContent>
        </Card>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No submissions yet. Start competing!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <Card key={submission.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{submission.competitionTitle}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(submission.submittedAt, "PPp")}
                    </div>
                  </div>
                  <Badge
                    variant={submission.status === "scored" ? "default" : "secondary"}
                    className="bg-gradient-to-r from-primary to-primary-glow"
                  >
                    {submission.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-4 items-center">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Score</p>
                    <p className="text-2xl font-bold text-primary">{submission.score.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">File Name</p>
                    <p className="font-medium truncate">{submission.fileName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Predictions</p>
                    <p className="font-medium">{submission.rowCount} rows</p>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
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

export default SubmissionHistory;
