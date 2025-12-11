/**
 * Database operations - organized by domain
 * 
 * This module re-exports all database functions from domain-specific modules.
 * Import from this file to access all database operations.
 * 
 * @example
 * import { getUser, createBook, saveSectionDraft } from './db';
 */

// Shared utilities
export { getDb, makeSectionDataId, parseSectionDataId } from './shared';

// User operations
export { upsertUser, getUser } from './users';

// Git credentials operations
export { upsertGitCredential, getGitCredential } from './git-credentials';

// Book operations
export {
  createBook,
  getUserBooks,
  getBook,
  updateBookLastModified,
  updateBookOriginalText,
  deleteBook,
} from './books';

// Section operations
export {
  saveSectionsToDatabase,
  updateBookSections, // deprecated
  saveSectionDraft,
  getSectionDraft,
  getAllSectionDrafts,
  getSectionStatus,
} from './sections';

// Export types
export type {
  SectionMetadata,
  Section,
  AllSectionDraftsResult,
} from './sections';
