import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Target, TrendingUp } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const [latestDatasets, setLatestDatasets] = useState<any[]>([]);

  // Fetch latest 3 datasets
  useEffect(() => {
    const q = query(
      collection(db, "datasets"),
      orderBy("createdAt", "desc"),
      limit(3)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLatestDatasets(data);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <div className="container py-12">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container py-12 space-y-8">
      {/* User Info */}
      <div className="flex items-center gap-6">
        <Avatar className="h-24 w-24">
          <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
          <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
            {user.displayName?.[0] || "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-4xl font-bold mb-2">{user.displayName}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Competitions Joined</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">Start competing!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Best Rank</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">-</div>
            <p className="text-xs text-muted-foreground mt-1">No submissions yet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">Make your first submission</p>
          </CardContent>
        </Card>
      </div>

      {/* Latest Datasets */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Latest Datasets</h2>
        {latestDatasets.length === 0 ? (
          <p className="text-muted-foreground">No datasets uploaded yet.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {latestDatasets.map((d) => (
              <Card key={d.id}>
                <CardHeader>
                  <CardTitle>{d.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{d.description}</p>
                  <p className="text-xs text-muted-foreground">Category: {d.category}</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={d.userAvatar} />
                      <AvatarFallback>{d.userName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="text-xs">{d.userName}</p>
                  </div>
                  <Link
                    to={`/datasets/${d.id}`}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    View Dataset
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>No activity yet. Upload or participate in competitions to see activity here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
