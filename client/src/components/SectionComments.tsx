import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
}

interface SectionCommentsProps {
  sectionId: string;
  comments?: Comment[];
  onAddComment?: (sectionId: string, content: string) => Promise<void>;
  onDeleteComment?: (sectionId: string, commentId: string) => Promise<void>;
  userName?: string;
}

export default function SectionComments({
  sectionId,
  comments = [],
  onAddComment,
  onDeleteComment,
  userName = "Anonymous",
}: SectionCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAddComment) {
        await onAddComment(sectionId, newComment);
        setNewComment("");
        toast.success("Comment added");
      }
    } catch (error) {
      toast.error("Failed to add comment");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      if (onDeleteComment) {
        await onDeleteComment(sectionId, commentId);
        toast.success("Comment deleted");
      }
    } catch (error) {
      toast.error("Failed to delete comment");
      console.error(error);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <CardTitle className="text-sm">Comments ({comments.length})</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">{isExpanded ? "▼" : "▶"}</span>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Comments List */}
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No comments yet</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="font-medium">{comment.author}</p>
                      <p className="text-xs text-muted-foreground">
                        {comment.timestamp instanceof Date
                          ? comment.timestamp.toLocaleString()
                          : new Date(comment.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          <div className="space-y-2 border-t pt-4">
            <Textarea
              placeholder="Add a comment about this section..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-20 text-sm"
              disabled={isSubmitting}
            />
            <Button
              onClick={handleAddComment}
              disabled={isSubmitting || !newComment.trim()}
              size="sm"
              className="w-full"
            >
              <Send className="h-3 w-3 mr-2" />
              {isSubmitting ? "Adding..." : "Add Comment"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
