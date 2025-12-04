import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserPlus, Trophy, Loader2, Mail, Check } from "lucide-react";
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
  pendingInvites: string[];
  score: number;
  createdAt: Date;
}

interface TeamInvite {
  id: string;
  teamId: string;
  teamName: string;
  competitionId: string;
  invitedEmail: string;
  invitedBy: string;
  invitedByName: string;
  status: "pending" | "accepted" | "declined";
  createdAt: Date;
}

interface CompetitionTeamsProps {
  competitionId: string;
}

export const CompetitionTeams = ({ competitionId }: CompetitionTeamsProps) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);

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
      
      teamsData.sort((a, b) => b.score - a.score);
      setTeams(teamsData);

      if (user) {
        const myTeam = teamsData.find((team) => team.members.includes(user.uid));
        setUserTeam(myTeam || null);
      }
    });

    return () => unsubscribe();
  }, [competitionId, user]);

  // Load pending invites for current user
  useEffect(() => {
    if (!user?.email) return;

    const q = query(
      collection(db, "team_invites"),
      where("competitionId", "==", competitionId),
      where("invitedEmail", "==", user.email),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invites = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as TeamInvite[];
      setPendingInvites(invites);
    });

    return () => unsubscribe();
  }, [competitionId, user?.email]);

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
        pendingInvites: [],
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
    if (!user || !inviteEmail.trim() || !userTeam) return;

    setIsInviting(true);
    try {
      // Check if email is already invited or is a member
      const existingInviteQuery = query(
        collection(db, "team_invites"),
        where("teamId", "==", teamId),
        where("invitedEmail", "==", inviteEmail.toLowerCase()),
        where("status", "==", "pending")
      );
      const existingInvites = await getDocs(existingInviteQuery);
      
      if (!existingInvites.empty) {
        toast.error("This email already has a pending invite");
        return;
      }

      // Create invite record
      await addDoc(collection(db, "team_invites"), {
        teamId,
        teamName: userTeam.name,
        competitionId,
        invitedEmail: inviteEmail.toLowerCase().trim(),
        invitedBy: user.uid,
        invitedByName: user.displayName || "Anonymous",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Update team pending invites
      await updateDoc(doc(db, "teams", teamId), {
        pendingInvites: arrayUnion(inviteEmail.toLowerCase().trim())
      });

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
    } catch (error) {
      console.error("Error inviting member:", error);
      toast.error("Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleAcceptInvite = async (invite: TeamInvite) => {
    if (!user) return;

    setIsJoining(invite.id);
    try {
      // Update invite status
      await updateDoc(doc(db, "team_invites", invite.id), {
        status: "accepted"
      });

      // Add user to team
      const teamRef = doc(db, "teams", invite.teamId);
      await updateDoc(teamRef, {
        members: arrayUnion(user.uid),
        [`memberNames.${user.uid}`]: user.displayName || "Anonymous",
        [`memberAvatars.${user.uid}`]: user.photoURL || "",
      });

      toast.success(`You've joined ${invite.teamName}!`);
    } catch (error) {
      console.error("Error joining team:", error);
      toast.error("Failed to join team");
    } finally {
      setIsJoining(null);
    }
  };

  const handleDeclineInvite = async (invite: TeamInvite) => {
    try {
      await updateDoc(doc(db, "team_invites", invite.id), {
        status: "declined"
      });
      toast.success("Invitation declined");
    } catch (error) {
      console.error("Error declining invite:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Mail className="h-5 w-5" />
              Pending Team Invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{invite.teamName}</p>
                  <p className="text-sm text-muted-foreground">Invited by {invite.invitedByName}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvite(invite)}
                    disabled={isJoining === invite.id}
                  >
                    {isJoining === invite.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeclineInvite(invite)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
                      Enter the email address of the person you want to invite. They must have an account to accept.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="teammate@example.com"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <Button 
                      onClick={() => handleInviteMember(userTeam.id)} 
                      disabled={!inviteEmail.trim() || isInviting}
                      className="w-full"
                    >
                      {isInviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
