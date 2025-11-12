import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, TrendingUp, Activity, BarChart3 } from "lucide-react";
import { collection, getCountFromServer, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SubmissionData {
  date: string;
  count: number;
}

interface ScoreDistribution {
  range: string;
  count: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalCompetitions: 0,
    activeCompetitions: 0,
    totalUsers: 0,
    totalSubmissions: 0,
  });
  const [submissionTrends, setSubmissionTrends] = useState<SubmissionData[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<ScoreDistribution[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const compsSnapshot = await getCountFromServer(collection(db, "competitions"));
        const activeCompsQuery = query(
          collection(db, "competitions"),
          where("status", "==", "active")
        );
        const activeCompsSnapshot = await getCountFromServer(activeCompsQuery);

        // Fetch all competitions to get submissions
        const competitionsSnapshot = await getDocs(collection(db, "competitions"));
        let totalSubmissions = 0;
        const uniqueUsers = new Set<string>();
        const submissionsByDate: Record<string, number> = {};
        const scoreRanges = {
          "0-20": 0,
          "21-40": 0,
          "41-60": 0,
          "61-80": 0,
          "81-100": 0,
        };

        for (const compDoc of competitionsSnapshot.docs) {
          const submissionsSnapshot = await getDocs(
            collection(db, "competitions", compDoc.id, "submissions")
          );
          
          submissionsSnapshot.forEach((subDoc) => {
            const data = subDoc.data();
            totalSubmissions++;
            
            if (data.userId) uniqueUsers.add(data.userId);
            
            // Track submissions by date
            if (data.timestamp) {
              const date = new Date(data.timestamp.toDate()).toLocaleDateString();
              submissionsByDate[date] = (submissionsByDate[date] || 0) + 1;
            }
            
            // Track score distribution
            if (data.score !== undefined) {
              const score = data.score;
              if (score <= 20) scoreRanges["0-20"]++;
              else if (score <= 40) scoreRanges["21-40"]++;
              else if (score <= 60) scoreRanges["41-60"]++;
              else if (score <= 80) scoreRanges["61-80"]++;
              else scoreRanges["81-100"]++;
            }
          });
        }

        // Convert to chart data
        const trendData = Object.entries(submissionsByDate)
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .slice(-7) // Last 7 days
          .map(([date, count]) => ({ date, count }));

        const distData = Object.entries(scoreRanges).map(([range, count]) => ({
          range,
          count,
        }));

        setStats({
          totalCompetitions: compsSnapshot.data().count,
          activeCompetitions: activeCompsSnapshot.data().count,
          totalUsers: uniqueUsers.size,
          totalSubmissions,
        });
        setSubmissionTrends(trendData);
        setScoreDistribution(distData);
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Dashboard Overview</h2>
        <p className="text-muted-foreground">Platform statistics and activity</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Competitions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalCompetitions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeCompetitions} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Participating users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalSubmissions}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Platform Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">High</div>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Submission Trends</TabsTrigger>
          <TabsTrigger value="scores">Score Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Submission Trends (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissionTrends.length > 0 ? (
                <ChartContainer
                  config={{
                    count: {
                      label: "Submissions",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={submissionTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No submission data available yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scoreDistribution.length > 0 && scoreDistribution.some(d => d.count > 0) ? (
                <ChartContainer
                  config={{
                    count: {
                      label: "Submissions",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No score data available yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
