import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { User, LogOut, History, Bell } from "lucide-react";
import juvanaLogo from "@/assets/juvana-logo.png";

export const Navbar = () => {
  const { user, signInWithGoogle, signOut } = useAuth();

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <img src={juvanaLogo} alt="Juvana" className="h-8 w-8" />
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Juvana
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/competitions" className="text-sm font-medium hover:text-primary transition-colors">
            Competitions
          </Link>
          
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                Dashboard
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.displayName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/submissions" className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      My Submissions
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/preferences" className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notification Preferences
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 text-destructive">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button onClick={signInWithGoogle} className="bg-gradient-to-r from-primary to-primary-glow">
              Sign In with Google
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};
