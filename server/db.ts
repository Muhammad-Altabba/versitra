import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, books, gitCredentials, InsertBook, sectionData, InsertSectionData } from "../drizzle/schema";
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


/**
 * Save sections to sectionData table
 * This replaces the old updateBookSections which stored sections in books.sections
 */
export async function saveSectionsToDatabase(
  bookId: string,
  sections: Array<{ id: string; content: string; startLine: number; endLine: number; type?: 'paragraph' | 'heading' | 'code' | 'list' }>
) {
  console.log('[Database.saveSectionsToDatabase] Saving sections for book:', {
    bookId,
    sectionsCount: sections.length,
    sectionIds: sections.map(s => s.id).slice(0, 5),
  });
  
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot save sections: database not available');
    return;
  }

  try {
    // Delete existing section data for this book
    await db.delete(sectionData).where(eq(sectionData.bookId, bookId));
    
    // Insert all sections as new sectionData entries
    for (const section of sections) {
      const sectionDataId = `${bookId}-${section.id}`;
      await db.insert(sectionData).values({
        id: sectionDataId,
        bookId,
        sectionId: section.id,
        originalContent: section.content,
        startLine: section.startLine.toString(),
        endLine: section.endLine.toString(),
        sectionType: section.type || 'paragraph',
        translationStatus: 'not_translated',
        createdAt: new Date(),
      });
    }
    
    // Update book's lastModified timestamp
    await db.update(books)
      .set({ lastModified: new Date() })
      .where(eq(books.id, bookId));
    
    console.log('[Database.saveSectionsToDatabase] ✅ Sections saved successfully');
  } catch (error) {
    console.error('[Database.saveSectionsToDatabase] Error saving sections:', error);
    throw error;
  }
}

// Deprecated: Use saveSectionsToDatabase instead
export async function updateBookSections(
  id: string,
  sections: Array<{ id: string; content: string; startLine: number; endLine: number; type?: 'paragraph' | 'heading' | 'code' | 'list' }>
) {
  console.warn('[Database.updateBookSections] DEPRECATED: Use saveSectionsToDatabase instead');
  return saveSectionsToDatabase(id, sections);
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



/**
 * Save draft translation for a section using the new sectionData table
 */
export async function saveSectionDraft(
  bookId: string,
  sectionId: string,
  source: string,
  translated: string
) {
  console.log('[saveSectionDraft] Saving draft for section:', { bookId, sectionId, translatedLength: translated.length });
  
  const db = await getDb();
  if (!db) {
    console.error('[saveSectionDraft] Database not available');
    throw new Error('Database not available');
  }

  try {
    const sectionDataId = `${bookId}-${sectionId}`;
    
    // Check if section data already exists
    const existingData = await db
      .select()
      .from(sectionData)
      .where(eq(sectionData.id, sectionDataId))
      .limit(1);

    if (existingData.length > 0) {
      // Update existing section data
      console.log('[saveSectionDraft] Updating existing section data');
      await db
        .update(sectionData)
        .set({
          draftTranslation: translated,
          draftSource: source,
          translationStatus: 'draft',
          draftLastModified: new Date(),
          lastModified: new Date(),
        })
        .where(eq(sectionData.id, sectionDataId));
    } else {
      // Create new section data
      console.log('[saveSectionDraft] Creating new section data');
      await db.insert(sectionData).values({
        id: sectionDataId,
        bookId,
        sectionId,
        originalContent: source,
        draftTranslation: translated,
        draftSource: source,
        translationStatus: 'draft',
        startLine: '0',
        endLine: '0',
        sectionType: 'paragraph',
        draftLastModified: new Date(),
      });
    }

    // Also update the book's lastModified timestamp to mark it as recently edited
    await db
      .update(books)
      .set({ lastModified: new Date() })
      .where(eq(books.id, bookId));

    console.log('[saveSectionDraft] ✅ Section draft saved successfully');
  } catch (error) {
    console.error('[saveSectionDraft] Error saving draft:', error);
    throw error;
  }
}

/**
 * Get draft for a specific section
 */
export async function getSectionDraft(bookId: string, sectionId: string) {
  console.log('[getSectionDraft] Fetching draft for section:', { bookId, sectionId });
  
  const db = await getDb();
  if (!db) {
    console.warn('[getSectionDraft] Database not available');
    return null;
  }

  try {
    const sectionDataId = `${bookId}-${sectionId}`;
    const result = await db
      .select()
      .from(sectionData)
      .where(eq(sectionData.id, sectionDataId))
      .limit(1);

    if (result.length === 0) {
      console.log('[getSectionDraft] No draft found for section');
      return null;
    }

    const data = result[0];
    console.log('[getSectionDraft] ✅ Draft found, translationStatus:', data.translationStatus);
    
    return {
      sectionId: data.sectionId,
      source: data.draftSource || data.originalContent,
      translated: data.draftTranslation || '',
      status: data.translationStatus,
      lastModified: data.draftLastModified || data.lastModified,
    };
  } catch (error) {
    console.error('[getSectionDraft] Error fetching draft:', error);
    return null;
  }
}

/**
 * Get all drafts for a book - returns book with cached sections and draft metadata
 */
export async function getAllSectionDrafts(bookId: string) {
  console.log('[getAllSectionDrafts] Fetching all drafts for book:', bookId);
  
  const db = await getDb();
  if (!db) {
    console.warn('[getAllSectionDrafts] Database not available');
    return { sections: [], sectionsMetadata: {} };
  }

  try {
    // Get the book with cached sections
    const bookResult = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);
    
    if (bookResult.length === 0) {
      console.log('[getAllSectionDrafts] Book not found');
      return { sections: [], sectionsMetadata: {} };
    }
    
    const book = bookResult[0];
    
    // Get all section data from sectionData table (source of truth)
    const sectionDataResults = await db
      .select()
      .from(sectionData)
      .where(eq(sectionData.bookId, bookId));

    console.log('[getAllSectionDrafts] ✅ Found', sectionDataResults.length, 'sections in sectionData table');
    
    // Reconstruct sections list from sectionData table
    const sections = sectionDataResults.map(data => ({
      id: data.sectionId,
      content: data.originalContent,
      startLine: parseInt(data.startLine),
      endLine: parseInt(data.endLine),
      type: (data.sectionType as 'paragraph' | 'heading' | 'code' | 'list') || 'paragraph',
    }));
    
    // Build metadata map and draft content map
    const sectionsMetadata: Record<string, any> = {};
    const sectionDrafts: Record<string, string> = {};
    
    // Create a map of section data by sectionId for quick lookup
    const sectionDataMap: Record<string, typeof sectionDataResults[0]> = {};
    for (const data of sectionDataResults) {
      sectionDataMap[data.sectionId] = data;
    }
    
    // Build metadata for ALL sections in the book
    for (const section of sections) {
      const data = sectionDataMap[section.id];
      
      if (data) {
        // Section has draft data
        sectionsMetadata[section.id] = {
          translated: data.translationStatus === 'committed',
          translationStatus: data.translationStatus,
          hasDraft: data.draftTranslation !== null && data.draftTranslation !== undefined,
          draftLastModified: data.draftLastModified,
          lastModified: data.draftLastModified || data.lastModified,
        };
        
        // Include draft content if it exists (including empty strings)
        if (data.draftTranslation !== null && data.draftTranslation !== undefined) {
          sectionDrafts[section.id] = data.draftTranslation;
        }
      } else {
        // Section has no draft data yet
        sectionsMetadata[section.id] = {
          translated: false,
          translationStatus: 'not_translated',
          hasDraft: false,
          draftLastModified: undefined,
          lastModified: undefined,
        };
      }
    }
    
    return {
      sections,
      sectionsMetadata,
      sectionDrafts,
    };
  } catch (error) {
    console.error('[getAllSectionDrafts] Error fetching drafts:', error);
    return { sections: [], sectionsMetadata: {}, sectionDrafts: {} };
  }
}

/**
 * Get section translation status
 */
export async function getSectionStatus(bookId: string, sectionId: string) {
  console.log('[getSectionStatus] Fetching status for section:', { bookId, sectionId });
  
  const db = await getDb();
  if (!db) {
    console.warn('[getSectionStatus] Database not available');
    return 'not_translated';
  }

  try {
    const sectionDataId = `${bookId}-${sectionId}`;
    const result = await db
      .select()
      .from(sectionData)
      .where(eq(sectionData.id, sectionDataId))
      .limit(1);

    if (result.length === 0) {
      return 'not_translated';
    }

    return result[0].translationStatus;
  } catch (error) {
    console.error('[getSectionStatus] Error fetching status:', error);
    return 'not_translated';
  }
}
