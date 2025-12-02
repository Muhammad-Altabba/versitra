import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, GitBranch } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CommitVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (title: string, description?: string) => Promise<void>;
  draftCount: number;
  isLoading?: boolean;
}

/**
 * CommitVersionDialog allows users to create a new version from drafts
 * Requires a version title and optional description
 */
export function CommitVersionDialog({
  open,
  onOpenChange,
  onCommit,
  draftCount,
  isLoading = false,
}: CommitVersionDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const handleCommit = async () => {
    if (!title.trim()) {
      return;
    }

    setIsCommitting(true);
    try {
      await onCommit(title.trim(), description.trim() || undefined);
      // Reset form
      setTitle('');
      setDescription('');
      onOpenChange(false);
    } finally {
      setIsCommitting(false);
    }
  };

  const isValid = title.trim().length > 0;
  const isDisabled = isCommitting || isLoading || !isValid || draftCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Create New Version
          </DialogTitle>
          <DialogDescription>
            Commit {draftCount} draft{draftCount !== 1 ? 's' : ''} as a new version
          </DialogDescription>
        </DialogHeader>

        {draftCount === 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No drafts to commit. Save some changes first.</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="version-title">Version Title *</Label>
            <Input
              id="version-title"
              placeholder="e.g., Chapter 1 - Initial translation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCommitting || isLoading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              A descriptive title for this version
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="version-description">Description (optional)</Label>
            <Textarea
              id="version-description"
              placeholder="Add notes about this version, changes made, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCommitting || isLoading}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Provide context for this version
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will commit all {draftCount} draft{draftCount !== 1 ? 's' : ''} to Git as a new version.
              The drafts will be cleared after committing.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCommitting || isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCommit}
            disabled={isDisabled}
            className="gap-2"
          >
            {isCommitting ? (
              <>
                <span className="animate-spin">⏳</span>
                Creating Version...
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4" />
                Create Version
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
