import { eq } from "drizzle-orm";
import { books, InsertBook, Book } from "../../drizzle/schema";
import { getDb } from "./shared";

/**
 * Create a new book
 */
export async function createBook(book: Omit<InsertBook, 'id' | 'createdAt' | 'lastModified'>): Promise<string | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database.createBook] Cannot create book: database not available');
    return undefined;
  }

  const { nanoid } = await import('nanoid');

  try {
    const id = nanoid();
    await db.insert(books).values({
      id,
      ...book,
    });
    return id;
  } catch (error) {
    console.error('[Database.createBook] Failed to create book:', error);
    throw error;
  }
}

/**
 * Get all books for a user
 */
export async function getUserBooks(userId: string): Promise<Book[]> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database.getUserBooks] Cannot get user books: database not available');
    return [];
  }

  return await db.select().from(books).where(eq(books.userId, userId));
}

/**
 * Get a book by ID
 */
export async function getBook(id: string): Promise<Book | undefined> {
  console.log(`[Database.getBook] Fetching book: ${id}`);
  const db = await getDb();
  if (!db) {
    console.warn('[Database.getBook] Cannot get book: database not available');
    return undefined;
  }

  const result = await db.select().from(books).where(eq(books.id, id)).limit(1);
  const book = result.length > 0 ? result[0] : undefined;
  
  if (book) {
    console.log(`[Database.getBook] Book found:`, {
      id: book.id,
      title: book.title,
    });
  } else {
    console.log(`[Database.getBook] Book not found: ${id}`);
  }
  
  return book;
}

/**
 * Update book's lastModified timestamp
 */
export async function updateBookLastModified(id: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database.updateBookLastModified] Cannot update book: database not available');
    return;
  }

  await db
    .update(books)
    .set({ lastModified: new Date() })
    .where(eq(books.id, id));
}

/**
 * Update book's original text and parsed markdown
 */
export async function updateBookOriginalText(
  id: string,
  originalText: string,
  parsedMarkdown: string
): Promise<void> {
  console.log('[Database.updateBookOriginalText] Updating original text for book:', {
    bookId: id,
    originalTextLength: originalText.length,
    parsedMarkdownLength: parsedMarkdown.length,
  });
  
  const db = await getDb();
  if (!db) {
    console.warn('[Database.updateBookOriginalText] Cannot update book original text: database not available');
    return;
  }

  await db
    .update(books)
    .set({ 
      originalText,
      parsedMarkdown,
      lastModified: new Date() 
    })
    .where(eq(books.id, id));
    
  console.log('[Database.updateBookOriginalText] ✅ Original text and markdown saved successfully');
}

/**
 * Delete a book
 */
export async function deleteBook(id: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database.deleteBook] Cannot delete book: database not available');
    return;
  }

  await db.delete(books).where(eq(books.id, id));
}
