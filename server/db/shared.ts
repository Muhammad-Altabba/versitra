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
 */
export function makeSectionDataId(bookId: string, sectionId: string): string {
  if (!bookId || !sectionId) {
    throw new Error('Invalid IDs: bookId and sectionId are required');
  }
  return `${bookId}-${sectionId}`;
}

/**
 * Helper to parse section data ID back to components
 */
export function parseSectionDataId(id: string): { bookId: string; sectionId: string } {
  const parts = id.split('-');
  if (parts.length < 2) {
    throw new Error(`Invalid section data ID format: ${id}`);
  }
  // Handle case where bookId or sectionId might contain hyphens
  // Assuming format is always bookId-sectionId where both are single segments
  const bookId = parts[0];
  const sectionId = parts.slice(1).join('-');
  return { bookId, sectionId };
}
