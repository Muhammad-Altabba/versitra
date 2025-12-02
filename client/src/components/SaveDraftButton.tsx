import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface SaveDraftButtonProps {
  onClick: () => Promise<void>;
  disabled?: boolean;
  hasChanges?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * SaveDraftButton triggers draft saving
 * Shows loading state while saving
 */
export function SaveDraftButton({
  onClick,
  disabled = false,
  hasChanges = false,
  className,
  variant = 'outline',
  size = 'sm',
}: SaveDraftButtonProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleClick = async () => {
    setIsSaving(true);
    try {
      await onClick();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isSaving || !hasChanges}
      variant={variant}
      size={size}
      className={cn('gap-2', className)}
      title={hasChanges ? 'Save draft' : 'No changes to save'}
    >
      <Save className="h-4 w-4" />
      {isSaving ? 'Saving...' : 'Save Draft'}
    </Button>
  );
}
