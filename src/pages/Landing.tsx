import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Users, TrendingUp, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Landing = () => {
  const { user, signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10" />
        <div className="container relative py-24 md:py-32">
          <div className="mx-auto max-w-4xl text-center space-y-8">
            <div className="inline-block px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
              <span className="text-sm font-medium text-primary">Tanzania's Premier Data Science Platform</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Compete. Learn.{" "}
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Build the Future
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join Tanzania's fastest-growing community of data scientists, machine learning engineers, 
              and AI enthusiasts. Solve real-world problems, compete for prizes, and advance your career.
            </p>
            
            <div className="flex gap-4 justify-center flex-wrap">
              {user ? (
                <Button asChild size="lg" className="bg-gradient-to-r from-primary to-primary-glow text-lg h-12 px-8">
                  <Link to="/competitions">Browse Competitions</Link>
                </Button>
              ) : (
                <Button onClick={signInWithGoogle} size="lg" className="bg-gradient-to-r from-primary to-primary-glow text-lg h-12 px-8">
                  Get Started
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="text-lg h-12 px-8">
                <Link to="/competitions">Explore</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Why Choose Juvana?
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 hover:shadow-lg transition-shadow border-border/50">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Real Competitions</h3>
              <p className="text-muted-foreground text-sm">
                Compete in challenges designed by local organizations with real prizes and impact.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow border-border/50">
              <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Vibrant Community</h3>
              <p className="text-muted-foreground text-sm">
                Connect with Tanzania's brightest data scientists and learn from each other.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow border-border/50">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Real-time Rankings</h3>
              <p className="text-muted-foreground text-sm">
                Track your progress with live leaderboards updated instantly after each submission.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow border-border/50">
              <div className="h-12 w-12 rounded-lg bg-primary-glow/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary-glow" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Colab Integration</h3>
              <p className="text-muted-foreground text-sm">
                Work seamlessly with Google Colab notebooks for your machine learning models.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <Card className="p-12 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 border-primary/20">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                Ready to Start Your Journey?
              </h2>
              <p className="text-lg text-muted-foreground">
                Join hundreds of data scientists already competing and learning on Juvana.
              </p>
              {!user && (
                <Button onClick={signInWithGoogle} size="lg" className="bg-gradient-to-r from-primary to-secondary text-lg h-12 px-8">
                  Sign Up Now
                </Button>
              )}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Landing;
