import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

// --------------------
// Types
// --------------------
interface Discussion {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  createdAt: Date;
}

interface Reply {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  createdAt: Date;
  parentReplyId?: string | null;
}

interface CompetitionDiscussionsProps {
  competitionId: string;
}

// --------------------
// Main Component
// --------------------
export const CompetitionDiscussions = ({ competitionId }: CompetitionDiscussionsProps) => {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch discussions
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

  // Post new discussion
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
      console.error(error);
      toast.error("Failed to post message");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* New discussion form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Discussion Forum
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

      {/* Discussion list */}
      <div className="space-y-4">
        {discussions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No discussions yet. Be the first to start a conversation!
            </CardContent>
          </Card>
        ) : (
          discussions.map((discussion) => (
            <DiscussionCard
              key={discussion.id}
              competitionId={competitionId}
              discussion={discussion}
              user={user}
            />
          ))
        )}
      </div>
    </div>
  );
};

// --------------------
// Discussion Card
// --------------------
interface DiscussionCardProps {
  competitionId: string;
  discussion: Discussion;
  user: any;
}

const DiscussionCard = ({ competitionId, discussion, user }: DiscussionCardProps) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <Avatar>
            <AvatarImage src={discussion.userAvatar} />
            <AvatarFallback>{discussion.userName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{discussion.userName}</h4>
              <span className="text-sm text-muted-foreground">
                {discussion.createdAt?.toLocaleDateString()} at{" "}
                {discussion.createdAt?.toLocaleTimeString()}
              </span>
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap">{discussion.message}</p>
          </div>
        </div>

        {/* Replies */}
        <DiscussionReplies competitionId={competitionId} discussionId={discussion.id} user={user} />
      </CardContent>
    </Card>
  );
};

// --------------------
// Replies Component (UNLIMITED NESTING)
// --------------------
interface DiscussionRepliesProps {
  competitionId: string;
  discussionId: string;
  user: any;
}

const DiscussionReplies = ({ competitionId, discussionId, user }: DiscussionRepliesProps) => {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all replies
  useEffect(() => {
    const q = query(
      collection(db, `competitions/${competitionId}/discussions/${discussionId}/replies`),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allReplies = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Reply[];
      setReplies(allReplies);
    });

    return () => unsubscribe();
  }, [competitionId, discussionId]);

  // Post top-level reply
  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newReply.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(
        collection(db, `competitions/${competitionId}/discussions/${discussionId}/replies`),
        {
          userId: user.uid,
          userName: user.displayName || "Anonymous",
          userAvatar: user.photoURL,
          message: newReply.trim(),
          createdAt: serverTimestamp(),
          parentReplyId: null,
        }
      );
      setNewReply("");
      toast.success("Reply posted!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to post reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recursive function to render nested replies
  const renderReplies = (parentId: string | null, level = 0) => {
    return replies
      .filter((r) => r.parentReplyId === parentId)
      .map((reply) => (
        <div key={reply.id} className={`ml-${level * 8} mt-2 space-y-2`}>
          <Card className="bg-muted/20">
            <CardContent className="flex gap-2 items-start p-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={reply.userAvatar} />
                <AvatarFallback>{reply.userName?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-semibold">{reply.userName}</p>
                <p className="text-sm text-muted-foreground">{reply.message}</p>

                {/* Reply to reply form */}
                {user && (
                  <ReplyForm
                    competitionId={competitionId}
                    discussionId={discussionId}
                    parentReplyId={reply.id}
                  />
                )}

                {/* Render child replies recursively */}
                {renderReplies(reply.id, level + 1)}
              </div>
            </CardContent>
          </Card>
        </div>
      ));
  };

  return (
    <div className="ml-16 mt-2 space-y-2">
      {renderReplies(null)}

      {/* Top-level reply form */}
      {user && (
        <form onSubmit={handleReplySubmit} className="flex gap-2 mt-2">
          <Textarea
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 min-h-[50px]"
          />
          <Button type="submit" disabled={isSubmitting || !newReply.trim()}>
            <Send className="h-4 w-4" /> Reply
          </Button>
        </form>
      )}
    </div>
  );
};

// --------------------
// Reply Form Component for Nested Replies
// --------------------
interface ReplyFormProps {
  competitionId: string;
  discussionId: string;
  parentReplyId: string;
}

const ReplyForm = ({ competitionId, discussionId, parentReplyId }: ReplyFormProps) => {
  const { user } = useAuth();
  const [childReply, setChildReply] = useState("");
  const [isSubmittingChild, setIsSubmittingChild] = useState(false);

  const handleChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !childReply.trim()) return;

    setIsSubmittingChild(true);
    try {
      await addDoc(
        collection(db, `competitions/${competitionId}/discussions/${discussionId}/replies`),
        {
          userId: user.uid,
          userName: user.displayName || "Anonymous",
          userAvatar: user.photoURL,
          message: childReply.trim(),
          createdAt: serverTimestamp(),
          parentReplyId,
        }
      );
      setChildReply("");
      toast.success("Reply posted!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to post reply");
    } finally {
      setIsSubmittingChild(false);
    }
  };

  return (
    <form onSubmit={handleChildSubmit} className="flex gap-2 mt-1">
      <Textarea
        value={childReply}
        onChange={(e) => setChildReply(e.target.value)}
        placeholder="Reply..."
        className="flex-1 min-h-[40px]"
      />
      <Button type="submit" disabled={isSubmittingChild || !childReply.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
};
