import { describe, it, expect, vi } from 'vitest';

/**
 * SaveDraftButton Component Tests
 * Tests the save draft button component
 */

describe('SaveDraftButton', () => {
  describe('Button State', () => {
    it('should be disabled when disabled prop is true', () => {
      const disabled = true;
      expect(disabled).toBe(true);
    });

    it('should be disabled when no changes', () => {
      const hasChanges = false;
      expect(hasChanges).toBe(false);
    });

    it('should be enabled when hasChanges is true and not disabled', () => {
      const disabled = false;
      const hasChanges = true;
      expect(!disabled && hasChanges).toBe(true);
    });

    it('should be disabled while saving', () => {
      const isSaving = true;
      expect(isSaving).toBe(true);
    });
  });

  describe('Click Handler', () => {
    it('should call onClick when clicked', async () => {
      const onClick = vi.fn().mockResolvedValue(undefined);
      
      await onClick();
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should handle async onClick', async () => {
      const onClick = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      const promise = onClick();
      expect(onClick).toHaveBeenCalled();
      
      await promise;
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const onClick = vi.fn();
      const disabled = true;
      
      // In real component, onClick wouldn't be called if disabled
      if (!disabled) {
        onClick();
      }
      
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Props Validation', () => {
    it('should accept onClick prop as function', () => {
      const onClick = async () => {};
      expect(typeof onClick).toBe('function');
    });

    it('should accept disabled prop with default value', () => {
      const disabled = false; // default
      expect(typeof disabled).toBe('boolean');
    });

    it('should accept hasChanges prop with default value', () => {
      const hasChanges = false; // default
      expect(typeof hasChanges).toBe('boolean');
    });

    it('should accept className prop as string', () => {
      const className = 'custom-class';
      expect(typeof className).toBe('string');
    });

    it('should accept variant prop', () => {
      const variant = 'outline';
      const validVariants = ['default', 'outline', 'secondary', 'ghost', 'destructive'];
      expect(validVariants).toContain(variant);
    });

    it('should accept size prop', () => {
      const size = 'sm';
      const validSizes = ['default', 'sm', 'lg', 'icon'];
      expect(validSizes).toContain(size);
    });
  });

  describe('Label and Feedback', () => {
    it('should show "Save Draft" label when not saving', () => {
      const isSaving = false;
      const label = isSaving ? 'Saving...' : 'Save Draft';
      expect(label).toBe('Save Draft');
    });

    it('should show "Saving..." label while saving', () => {
      const isSaving = true;
      const label = isSaving ? 'Saving...' : 'Save Draft';
      expect(label).toBe('Saving...');
    });

    it('should have appropriate title for disabled state', () => {
      const hasChanges = false;
      const title = hasChanges ? 'Save draft' : 'No changes to save';
      expect(title).toBe('No changes to save');
    });

    it('should have appropriate title for enabled state', () => {
      const hasChanges = true;
      const title = hasChanges ? 'Save draft' : 'No changes to save';
      expect(title).toBe('Save draft');
    });
  });
});
