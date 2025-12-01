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
    <div className="border border-border rounded-lg bg-card hover:border-primary/50 transition-colors">
      <div className="p-4">
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-10 w-10">
              <AvatarImage src={discussion.userAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {discussion.userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground hover:text-primary cursor-pointer">
                {discussion.userName}
              </span>
              <span className="text-xs text-muted-foreground">
                • {discussion.createdAt?.toLocaleDateString()}
              </span>
            </div>
            
            <div className="text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {discussion.message}
            </div>
          </div>
        </div>

        {/* Replies */}
        <DiscussionReplies competitionId={competitionId} discussionId={discussion.id} user={user} />
      </div>
    </div>
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
        parentReplyId: doc.data().parentReplyId ?? null,
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

  // Recursive function to render nested replies (Reddit-style)
  const renderReplies = (parentId: string | null, level = 0) => {
    const maxLevel = 6; // Limit nesting depth for better UX
    const actualLevel = Math.min(level, maxLevel);
    
    return replies
      .filter((r) => (r.parentReplyId ?? null) === parentId)
      .map((reply) => (
        <div 
          key={reply.id} 
          style={{ marginLeft: actualLevel * 24 }} 
          className="mt-2 border-l-2 border-border/50 pl-3"
        >
          <div className="flex gap-2 items-start">
            <Avatar className="h-7 w-7 mt-1">
              <AvatarImage src={reply.userAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {reply.userName?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold hover:text-primary cursor-pointer">
                  {reply.userName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {reply.createdAt?.toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm leading-relaxed break-words mb-2">{reply.message}</p>

              {/* Reply to reply form */}
              {user && level < maxLevel && (
                <ReplyForm
                  competitionId={competitionId}
                  discussionId={discussionId}
                  parentReplyId={reply.id}
                />
              )}

              {/* Render child replies recursively */}
              {renderReplies(reply.id, level + 1)}
            </div>
          </div>
        </div>
      ));
  };

  return (
    <div className="ml-12 mt-4 space-y-2">
      {renderReplies(null)}

      {/* Top-level reply form */}
      {user && (
        <form onSubmit={handleReplySubmit} className="flex gap-2 mt-3 items-start">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.photoURL || ""} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {user.displayName?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <Textarea
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 min-h-[60px]"
          />
          <Button type="submit" disabled={isSubmitting || !newReply.trim()} size="sm">
            <Send className="h-4 w-4 mr-1" /> Reply
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
  const [showForm, setShowForm] = useState(false);

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
      setShowForm(false);
      toast.success("Reply posted!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to post reply");
    } finally {
      setIsSubmittingChild(false);
    }
  };

  if (!showForm) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowForm(true)}
        className="h-7 text-xs text-muted-foreground hover:text-foreground"
      >
        Reply
      </Button>
    );
  }

  return (
    <form onSubmit={handleChildSubmit} className="flex gap-2 mt-2">
      <Textarea
        value={childReply}
        onChange={(e) => setChildReply(e.target.value)}
        placeholder="Write a reply..."
        className="flex-1 min-h-[60px] text-sm"
        autoFocus
      />
      <div className="flex flex-col gap-1">
        <Button type="submit" disabled={isSubmittingChild || !childReply.trim()} size="sm">
          <Send className="h-3 w-3" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
