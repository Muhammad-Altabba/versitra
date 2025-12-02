import { Badge } from '@/components/ui/badge';
import { AlertCircle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraftIndicatorProps {
  hasDraft: boolean;
  isSaving?: boolean;
  lastSaved?: Date;
  className?: string;
}

/**
 * DraftIndicator shows the current draft status
 * Displays whether there are unsaved drafts and when they were last saved
 */
export function DraftIndicator({
  hasDraft,
  isSaving = false,
  lastSaved,
  className,
}: DraftIndicatorProps) {
  if (!hasDraft && !isSaving) {
    return null;
  }

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isSaving && (
        <Badge variant="secondary" className="animate-pulse">
          <Save className="h-3 w-3 mr-1" />
          Saving...
        </Badge>
      )}
      {hasDraft && !isSaving && (
        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3 w-3 mr-1" />
          Draft saved
          {lastSaved && ` ${formatTime(lastSaved)}`}
        </Badge>
      )}
    </div>
  );
}
