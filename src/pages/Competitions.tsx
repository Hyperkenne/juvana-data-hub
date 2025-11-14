import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Trophy } from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Competition } from "@/types/competition";
import { CompetitionFilters } from "@/components/CompetitionFilters";

const Competitions = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const q = query(collection(db, "competitions"), orderBy("deadline", "desc"));
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

    fetchCompetitions();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(competitions.map((c) => c.category));
    return Array.from(cats);
  }, [competitions]);

  const filteredCompetitions = useMemo(() => {
    return competitions.filter((competition) => {
      const matchesSearch =
        searchTerm === "" ||
        competition.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        competition.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || competition.category === selectedCategory;

      const matchesStatus =
        selectedStatus === "all" || competition.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [competitions, searchTerm, selectedCategory, selectedStatus]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("all");
    setSelectedStatus("all");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-secondary text-secondary-foreground";
      case "upcoming": return "bg-accent text-accent-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "";
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
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Active Competitions</h1>
        <p className="text-muted-foreground text-lg">
          Browse ongoing and upcoming data science challenges
        </p>
      </div>

      <CompetitionFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        categories={categories}
        onClearFilters={handleClearFilters}
      />

      {filteredCompetitions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-lg">
              No competitions found matching your filters
            </p>
            <Button onClick={handleClearFilters} variant="outline" className="mt-4">
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompetitions.map((competition) => (
            <Card key={competition.id} className="hover:shadow-lg transition-all border-border/50 flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge className={getStatusColor(competition.status)}>
                    {competition.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {competition.category}
                  </Badge>
                </div>
                <CardTitle className="line-clamp-2">{competition.title}</CardTitle>
                <CardDescription className="line-clamp-3">
                  {competition.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-grow">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Trophy className="h-4 w-4 text-accent" />
                    <span className="font-semibold text-accent">{competition.prize}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Ends {new Date(competition.deadline).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{competition.participants} participants</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <Button asChild className="w-full bg-gradient-to-r from-primary to-primary-glow">
                  <Link to={`/competition/${competition.id}`}>View Details</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Competitions;
