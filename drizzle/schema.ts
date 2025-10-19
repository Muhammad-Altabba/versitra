import { mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Books table - metadata for translation projects
 * Actual content lives in Git repositories
 */
export const books = mysqlTable("books", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  repoName: varchar("repoName", { length: 255 }).notNull(),
  repoUrl: text("repoUrl").notNull(),
  gitProvider: mysqlEnum("gitProvider", ["github", "gitlab"]).notNull(),
  title: text("title"),
  sourceLanguage: varchar("sourceLanguage", { length: 10 }),
  targetLanguage: varchar("targetLanguage", { length: 10 }),
  sourceContent: text("sourceContent"), // Full source document
  sections: text("sections"), // JSON array of split sections
  createdAt: timestamp("createdAt").defaultNow(),
  lastModified: timestamp("lastModified").defaultNow(),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

/**
 * Git credentials table - encrypted OAuth tokens
 * Used for Git API operations on behalf of users
 */
export const gitCredentials = mysqlTable("gitCredentials", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull().unique(),
  gitProvider: mysqlEnum("gitProvider", ["github", "gitlab"]).notNull(),
  gitUsername: varchar("gitUsername", { length: 255 }).notNull(),
  accessToken: text("accessToken").notNull(), // Encrypted
  refreshToken: text("refreshToken"), // Encrypted (GitLab only)
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type GitCredential = typeof gitCredentials.$inferSelect;
export type InsertGitCredential = typeof gitCredentials.$inferInsert;
