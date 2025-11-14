import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

interface Discussion {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  createdAt: Date;
}

interface CompetitionDiscussionsProps {
  competitionId: string;
}

export const CompetitionDiscussions = ({ competitionId }: CompetitionDiscussionsProps) => {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, `competitions/${competitionId}/discussions`),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Discussion[];
      
      setDiscussions(msgs);
    });

    return () => unsubscribe();
  }, [competitionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `competitions/${competitionId}/discussions`), {
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userAvatar: user.photoURL,
        message: newMessage.trim(),
        createdAt: serverTimestamp(),
      });

      setNewMessage("");
      toast.success("Message posted!");
    } catch (error) {
      console.error("Error posting message:", error);
      toast.error("Failed to post message");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Discussion Forum
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                placeholder="Ask a question or share insights..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting || !newMessage.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Post Message
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Sign in to participate in discussions
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {discussions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No discussions yet. Be the first to start a conversation!
            </CardContent>
          </Card>
        ) : (
          discussions.map((discussion) => (
            <Card key={discussion.id}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <Avatar>
                    <AvatarImage src={discussion.userAvatar} />
                    <AvatarFallback>
                      {discussion.userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{discussion.userName}</h4>
                      <span className="text-sm text-muted-foreground">
                        {discussion.createdAt?.toLocaleDateString()} at{" "}
                        {discussion.createdAt?.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {discussion.message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
