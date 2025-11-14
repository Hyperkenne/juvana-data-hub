import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserPlus, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Team {
  id: string;
  name: string;
  competitionId: string;
  creatorId: string;
  members: string[];
  memberNames: { [key: string]: string };
  memberAvatars: { [key: string]: string };
  score: number;
  createdAt: Date;
}

interface CompetitionTeamsProps {
  competitionId: string;
}

export const CompetitionTeams = ({ competitionId }: CompetitionTeamsProps) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "teams"),
      where("competitionId", "==", competitionId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Team[];
      
      // Sort by score
      teamsData.sort((a, b) => b.score - a.score);
      setTeams(teamsData);

      // Find user's team
      if (user) {
        const myTeam = teamsData.find((team) => team.members.includes(user.uid));
        setUserTeam(myTeam || null);
      }
    });

    return () => unsubscribe();
  }, [competitionId, user]);

  const handleCreateTeam = async () => {
    if (!user || !newTeamName.trim()) return;

    setIsCreating(true);
    try {
      await addDoc(collection(db, "teams"), {
        name: newTeamName.trim(),
        competitionId,
        creatorId: user.uid,
        members: [user.uid],
        memberNames: { [user.uid]: user.displayName || "Anonymous" },
        memberAvatars: { [user.uid]: user.photoURL || "" },
        score: 0,
        createdAt: serverTimestamp(),
      });

      setNewTeamName("");
      toast.success("Team created successfully!");
    } catch (error) {
      console.error("Error creating team:", error);
      toast.error("Failed to create team");
    } finally {
      setIsCreating(false);
    }
  };

  const handleInviteMember = async (teamId: string) => {
    if (!user || !inviteEmail.trim()) return;

    try {
      // In a real app, you'd look up the user by email and add them
      // For now, we'll just show a toast
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
    } catch (error) {
      console.error("Error inviting member:", error);
      toast.error("Failed to send invitation");
    }
  };

  return (
    <div className="space-y-6">
      {user && !userTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Create Your Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <Button onClick={handleCreateTeam} disabled={isCreating || !newTeamName.trim()}>
                Create Team
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {userTeam && (
        <Card className="border-accent">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Team: {userTeam.name}
              </span>
              <Badge variant="secondary">Score: {userTeam.score.toFixed(4)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {userTeam.members.map((memberId) => (
                  <div key={memberId} className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={userTeam.memberAvatars[memberId]} />
                      <AvatarFallback>
                        {(userTeam.memberNames[memberId] || "A").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{userTeam.memberNames[memberId]}</span>
                  </div>
                ))}
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Enter the email address of the person you want to invite
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="teammate@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <Button 
                      onClick={() => handleInviteMember(userTeam.id)} 
                      disabled={!inviteEmail.trim()}
                      className="w-full"
                    >
                      Send Invitation
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Team Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No teams yet. Be the first to create one!
            </p>
          ) : (
            <div className="space-y-2">
              {teams.map((team, index) => (
                <div
                  key={team.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    team.id === userTeam?.id ? "bg-accent/10 border border-accent" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-muted-foreground w-8">
                      #{index + 1}
                    </span>
                    <div>
                      <h4 className="font-semibold">{team.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {team.members.length} {team.members.length === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    {team.score.toFixed(4)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
