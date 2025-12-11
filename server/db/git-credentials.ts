import { eq } from "drizzle-orm";
import { gitCredentials, GitCredential } from "../../drizzle/schema";
import { getDb } from "./shared";

/**
 * Upsert git credential (insert or update)
 */
export async function upsertGitCredential(
  userId: string,
  gitProvider: 'github' | 'gitlab',
  gitUsername: string,
  accessToken: string,
  refreshToken?: string,
  tokenExpiresAt?: Date
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database.upsertGitCredential] Cannot upsert git credential: database not available');
    return;
  }

  const { encrypt } = await import('../lib/encryption');
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
    console.error('[Database.upsertGitCredential] Failed to upsert git credential:', error);
    throw error;
  }
}

/**
 * Get git credential for a user (with decrypted tokens)
 */
export async function getGitCredential(userId: string): Promise<(GitCredential & { accessToken: string; refreshToken: string | null }) | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database.getGitCredential] Cannot get git credential: database not available');
    return undefined;
  }

  const { decrypt } = await import('../lib/encryption');

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
