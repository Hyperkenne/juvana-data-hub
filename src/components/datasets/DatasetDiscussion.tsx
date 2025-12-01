import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ------------------------
// Recursive Comment Component
// ------------------------
const CommentItem = ({ comment, replies, onReply }: any) => {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");

  return (
    <div className="border-l pl-4 mt-4">
      {/* Comment Body */}
      <div className="flex gap-3 items-start">
        <img
          src={comment.userPhoto}
          className="w-8 h-8 rounded-full"
        />
        <div>
          <p className="font-semibold">{comment.userName}</p>
          <p className="text-sm">{comment.text}</p>

          <button
            className="text-xs text-blue-500 mt-1"
            onClick={() => setShowReplyBox(!showReplyBox)}
          >
            Reply
          </button>

          {showReplyBox && (
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <Button
                onClick={() => {
                  onReply(comment.id, replyText);
                  setReplyText("");
                  setShowReplyBox(false);
                }}
              >
                Reply
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Recursive Replies */}
      <div className="ml-6 border-l pl-4">
        {replies.map((reply: any) => (
          <CommentItem
            key={reply.id}
            comment={reply}
            replies={reply.children}
            onReply={onReply}
          />
        ))}
      </div>
    </div>
  );
};

// ------------------------
// Main Discussion Component
// ------------------------

const DatasetDiscussion = ({ datasetId }: { datasetId: string }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, `datasets/${datasetId}/discussion`),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      // Build tree structure for unlimited nesting
      const map: any = {};
      const roots: any[] = [];

      all.forEach((c) => {
        map[c.id] = { ...c, children: [] };
      });

      all.forEach((c) => {
        if (c.parentId) {
          map[c.parentId]?.children.push(map[c.id]);
        } else {
          roots.push(map[c.id]);
        }
      });

      setComments(roots);
    });

    return () => unsub();
  }, [datasetId]);

  const addComment = async (parentId: string | null, text: string) => {
    if (!user || !text.trim()) return;

    await addDoc(collection(db, `datasets/${datasetId}/discussion`), {
      text,
      userId: user.uid,
      userName: user.displayName,
      userPhoto: user.photoURL || "",
      parentId,
      createdAt: serverTimestamp(),
    });
  };

  return (
    <div className="border p-6 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Discussion</h2>

      {/* Add New Comment */}
      {user ? (
        <div className="flex gap-3 mb-6">
          <Input
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <Button
            onClick={() => {
              addComment(null, newComment);
              setNewComment("");
            }}
          >
            Post
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-4">
          Login to post comments.
        </p>
      )}

      {/* Recursive Tree Render */}
      <div>
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={comment.children}
            onReply={(parentId: string, replyText: string) =>
              addComment(parentId, replyText)
            }
          />
        ))}
      </div>
    </div>
  );
};

export default DatasetDiscussion;
