import { Button } from '@/components/ui/button';
import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { CommitVersionDialog } from './CommitVersionDialog';

interface CommitVersionButtonProps {
  draftCount: number;
  onCommit: (title: string, description?: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * CommitVersionButton opens the commit dialog
 * Shows the number of drafts ready to commit
 */
export function CommitVersionButton({
  draftCount,
  onCommit,
  disabled = false,
  className,
  variant = 'default',
  size = 'sm',
}: CommitVersionButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCommit = async (title: string, description?: string) => {
    setIsLoading(true);
    try {
      await onCommit(title, description);
    } finally {
      setIsLoading(false);
    }
  };

  const hasNoDrafts = draftCount === 0;

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        disabled={disabled || hasNoDrafts}
        variant={variant}
        size={size}
        className={cn('gap-2', className)}
        title={
          hasNoDrafts
            ? 'No drafts to commit. Save some changes first.'
            : `Commit ${draftCount} draft${draftCount !== 1 ? 's' : ''}`
        }
      >
        <GitBranch className="h-4 w-4" />
        Create Version
        {draftCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary-foreground text-primary text-xs font-semibold">
            {draftCount}
          </span>
        )}
      </Button>

      <CommitVersionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCommit={handleCommit}
        draftCount={draftCount}
        isLoading={isLoading}
      />
    </>
  );
}
