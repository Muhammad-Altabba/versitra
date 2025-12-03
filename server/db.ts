import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, books, gitCredentials, InsertBook } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = 'admin';
        values.role = 'admin';
        updateSet.role = 'admin';
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Git credentials management
 */
export async function upsertGitCredential(
  userId: string,
  gitProvider: 'github' | 'gitlab',
  gitUsername: string,
  accessToken: string,
  refreshToken?: string,
  tokenExpiresAt?: Date
) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot upsert git credential: database not available');
    return;
  }

  const { encrypt } = await import('./lib/encryption');
  const { nanoid } = await import('nanoid');

  try {
    await db
      .insert(gitCredentials)
      .values({
        id: nanoid(),
        userId,
        gitProvider,
        gitUsername,
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          gitUsername,
          accessToken: encrypt(accessToken),
          refreshToken: refreshToken ? encrypt(refreshToken) : null,
          tokenExpiresAt,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('[Database] Failed to upsert git credential:', error);
    throw error;
  }
}

export async function getGitCredential(userId: string) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get git credential: database not available');
    return undefined;
  }

  const { decrypt } = await import('./lib/encryption');

  const result = await db
    .select()
    .from(gitCredentials)
    .where(eq(gitCredentials.userId, userId))
    .limit(1);

  if (result.length === 0) {
    return undefined;
  }

  const cred = result[0];
  return {
    ...cred,
    accessToken: decrypt(cred.accessToken),
    refreshToken: cred.refreshToken ? decrypt(cred.refreshToken) : null,
  };
}

/**
 * Books management
 */
export async function createBook(book: Omit<InsertBook, 'id' | 'createdAt' | 'lastModified'>) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot create book: database not available');
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
    console.error('[Database] Failed to create book:', error);
    throw error;
  }
}

export async function getUserBooks(userId: string) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get user books: database not available');
    return [];
  }

  return await db.select().from(books).where(eq(books.userId, userId));
}

export async function getBook(id: string) {
  console.log(`[Database.getBook] Fetching book: ${id}`);
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get book: database not available');
    return undefined;
  }

  const result = await db.select().from(books).where(eq(books.id, id)).limit(1);
  const book = result.length > 0 ? result[0] : undefined;
  
  if (book) {
    console.log(`[Database.getBook] Book found:`, {
      id: book.id,
      title: book.title,
      hasSections: !!book.sections,
      sectionsCount: book.sections?.length || 0,
      hasMetadata: !!book.sectionsMetadata,
    });
  } else {
    console.log(`[Database.getBook] Book not found: ${id}`);
  }
  
  return book;
}

export async function updateBookLastModified(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot update book: database not available');
    return;
  }

  await db
    .update(books)
    .set({ lastModified: new Date() })
    .where(eq(books.id, id));
}

export async function deleteBook(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot delete book: database not available');
    return;
  }

  await db.delete(books).where(eq(books.id, id));
}


export async function updateBookSections(
  id: string,
  sections: Array<{ id: string; content: string; startLine: number; endLine: number }>
) {
  console.log('[Database.updateBookSections] Updating sections for book:', {
    bookId: id,
    sectionsCount: sections.length,
    sectionIds: sections.map(s => s.id).slice(0, 5),
  });
  
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot update book sections: database not available');
    return;
  }

  await db
    .update(books)
    .set({ 
      sections,
      lastModified: new Date() 
    })
    .where(eq(books.id, id));
    
  console.log('[Database.updateBookSections] ✅ Sections saved successfully');
}

export async function updateSectionMetadata(
  id: string,
  sectionId: string,
  metadata: { translated: boolean; lastModified?: string }
) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot update section metadata: database not available');
    return;
  }

  // Get current book
  const book = await getBook(id);
  if (!book) {
    console.warn('[Database] Book not found');
    return;
  }

  // Update metadata
  const currentMetadata = (book.sectionsMetadata as Record<string, any>) || {};
  currentMetadata[sectionId] = metadata;

  await db
    .update(books)
    .set({ 
      sectionsMetadata: currentMetadata,
      lastModified: new Date() 
    })
    .where(eq(books.id, id));
}



/**
 * Save a draft translation for a section (not committed to Git yet)
 */
export async function saveDraft(
  bookId: string,
  sectionId: string,
  source: string,
  translated: string
) {
  console.log('[saveDraft] Starting save operation:', { bookId, sectionId, translatedLength: translated.length });
  
  const db = await getDb();
  if (!db) {
    console.error('[saveDraft] Database not available');
    throw new Error('Database not available');
  }

  try {
    // Get current book
    console.log('[saveDraft] Fetching book:', bookId);
    const book = await getBook(bookId);
    if (!book) {
      console.error('[saveDraft] Book not found:', bookId);
      throw new Error('Book not found');
    }
    console.log('[saveDraft] Book found, current drafts:', Object.keys(book.drafts || {}).length);

    // Update drafts
    const currentDrafts = (book.drafts as Record<string, any>) || {};
    currentDrafts[sectionId] = {
      source,
      translated,
      lastModified: new Date().toISOString(),
    };

    console.log('[saveDraft] Prepared new drafts object:', {
      totalDrafts: Object.keys(currentDrafts).length,
      sectionIds: Object.keys(currentDrafts),
    });

    console.log('[saveDraft] Executing database update...');
    const updateResult = await db
      .update(books)
      .set({ 
        drafts: currentDrafts,
        lastModified: new Date() 
      })
      .where(eq(books.id, bookId));

    console.log('[saveDraft] Database update completed:', updateResult);

    // Verify the update was persisted
    console.log('[saveDraft] Verifying update by re-fetching book...');
    const verifyBook = await getBook(bookId);
    if (verifyBook && verifyBook.drafts && verifyBook.drafts[sectionId]) {
      console.log('[saveDraft] ✓ Draft verified in database:', {
        sectionId,
        hasTranslated: !!verifyBook.drafts[sectionId].translated,
      });
    } else {
      console.error('[saveDraft] ✗ Draft NOT found after save!');
      throw new Error('Draft not persisted to database');
    }
  } catch (error) {
    console.error('[saveDraft] Error:', error);
    throw error;
  }
}

/**
 * Get draft for a specific section
 */
export async function getDraft(bookId: string, sectionId: string) {
  const book = await getBook(bookId);
  if (!book || !book.drafts) {
    return null;
  }

  const drafts = book.drafts as Record<string, any>;
  return drafts[sectionId] || null;
}

/**
 * Get all drafts for a book
 */
export async function getAllDrafts(bookId: string) {
  const book = await getBook(bookId);
  if (!book || !book.drafts) {
    return {};
  }

  return book.drafts as Record<string, { source: string; translated: string; lastModified: string }>;
}

/**
 * Clear draft after committing to Git
 */
export async function clearDraft(bookId: string, sectionId: string) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot clear draft: database not available');
    return;
  }

  // Get current book
  const book = await getBook(bookId);
  if (!book) {
    console.warn('[Database] Book not found');
    return;
  }

  // Remove draft
  const currentDrafts = (book.drafts as Record<string, any>) || {};
  delete currentDrafts[sectionId];

  await db
    .update(books)
    .set({ 
      drafts: currentDrafts,
      lastModified: new Date() 
    })
    .where(eq(books.id, bookId));
}

/**
 * Clear all drafts for a book
 */
export async function clearAllDrafts(bookId: string) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot clear drafts: database not available');
    return;
  }

  await db
    .update(books)
    .set({ 
      drafts: {},
      lastModified: new Date() 
    })
    .where(eq(books.id, bookId));
}



export async function updateBookOriginalText(
  id: string,
  originalText: string,
  parsedMarkdown: string
) {
  console.log('[Database.updateBookOriginalText] Updating original text for book:', {
    bookId: id,
    originalTextLength: originalText.length,
    parsedMarkdownLength: parsedMarkdown.length,
  });
  
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot update book original text: database not available');
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

