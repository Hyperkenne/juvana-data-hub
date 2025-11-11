import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, TrendingUp, Activity } from "lucide-react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalCompetitions: 0,
    activeCompetitions: 0,
    totalUsers: 0,
    totalSubmissions: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const compsSnapshot = await getCountFromServer(collection(db, "competitions"));
        const activeCompsQuery = query(
          collection(db, "competitions"),
          where("status", "==", "active")
        );
        const activeCompsSnapshot = await getCountFromServer(activeCompsQuery);

        setStats({
          totalCompetitions: compsSnapshot.data().count,
          activeCompetitions: activeCompsSnapshot.data().count,
          totalUsers: 0, // Would need to aggregate from all competitions
          totalSubmissions: 0, // Would need to aggregate from all competitions
        });
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Activity feed coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
