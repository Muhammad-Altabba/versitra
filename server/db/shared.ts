import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Lazily create the drizzle instance so local tooling can run without a DB.
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Helper to create composite section data ID
 * Uses :: delimiter to avoid conflicts with hyphens in bookId or sectionId
 */
export function makeSectionDataId(bookId: string, sectionId: string): string {
  if (!bookId || !sectionId) {
    throw new Error('Invalid IDs: bookId and sectionId are required');
  }
  return `${bookId}::${sectionId}`;
}

/**
 * Helper to parse section data ID back to components
 * Uses :: delimiter to avoid conflicts with hyphens in bookId or sectionId
 */
export function parseSectionDataId(id: string): { bookId: string; sectionId: string } {
  const parts = id.split('::');
  if (parts.length !== 2) {
    throw new Error(`Invalid section data ID format: ${id}. Expected format: bookId::sectionId`);
  }
  return { bookId: parts[0], sectionId: parts[1] };
}
