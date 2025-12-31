import { describe, it, expect } from 'vitest';
import { generateCommitMessage, getTranslationFilePath } from './service';

describe('Version Service', () => {
  describe('generateCommitMessage', () => {
    it('should generate commit message with title only', () => {
      const message = generateCommitMessage('Version 1.0', undefined, 5);
      expect(message).toContain('Version 1.0');
      expect(message).toContain('Translated 5 sections');
    });

    it('should generate commit message with title and description', () => {
      const message = generateCommitMessage(
        'Version 1.0',
        'Initial translation',
        5
      );
      expect(message).toContain('Version 1.0');
      expect(message).toContain('Initial translation');
      expect(message).toContain('Translated 5 sections');
    });

    it('should use singular "section" for count of 1', () => {
      const message = generateCommitMessage('Version 1.0', undefined, 1);
      expect(message).toContain('Translated 1 section');
      expect(message).not.toContain('sections');
    });

    it('should use plural "sections" for count > 1', () => {
      const message = generateCommitMessage('Version 1.0', undefined, 3);
      expect(message).toContain('Translated 3 sections');
    });
  });

  describe('getTranslationFilePath', () => {
    it('should generate correct file path', () => {
      const path = getTranslationFilePath('es', 'My Book Title');
      expect(path).toBe('translations/es/my-book-title.md');
    });

    it('should sanitize book title', () => {
      const path = getTranslationFilePath('fr', 'Book: A Guide (2024)!');
      expect(path).toBe('translations/fr/book-a-guide-2024.md');
    });

    it('should handle multiple spaces and special characters', () => {
      const path = getTranslationFilePath('de', 'The   Great  Book!!!');
      expect(path).toBe('translations/de/the-great-book.md');
    });

    it('should handle non-ASCII characters', () => {
      const path = getTranslationFilePath('ar', 'كتاب عربي');
      // Should strip non-ASCII and return a valid path
      expect(path).toMatch(/^translations\/ar\/[a-z0-9-]*\.md$/);
    });
  });
});
