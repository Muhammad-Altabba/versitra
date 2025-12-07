import { mysqlEnum, mysqlTable, text, longtext, timestamp, varchar, json } from "drizzle-orm/mysql-core";

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
  originalText: longtext("originalText"), // Original extracted text from PDF or user input (supports up to 4GB)
  parsedMarkdown: longtext("parsedMarkdown"), // Markdown version of the original text (supports up to 4GB)
  createdAt: timestamp("createdAt").defaultNow(),
  lastModified: timestamp("lastModified").defaultNow(),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

// Note: Section data is now stored exclusively in the sectionData table, not in books.sections

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

/**
 * User preferences table - stores user settings and preferences
 */
export const userPreferences = mysqlTable("userPreferences", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull().unique(),
  autoSaveDrafts: mysqlEnum("autoSaveDrafts", ["enabled", "disabled"]).default("enabled").notNull(),
  aiApiProvider: varchar("aiApiProvider", { length: 50 }).default("builtin"), // 'builtin', 'openai', 'claude', 'gemini'
  aiApiKey: text("aiApiKey"), // Encrypted API key for custom provider
  aiApiEndpoint: text("aiApiEndpoint"), // Custom API endpoint
  aiUsageLimit: varchar("aiUsageLimit", { length: 50 }).default("unlimited"), // Usage limit per month
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

/**
 * AI usage tracking table - tracks API usage per user
 */
export const aiUsageTracking = mysqlTable("aiUsageTracking", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM format
  requestCount: varchar("requestCount", { length: 20 }).default("0").notNull(),
  tokenCount: varchar("tokenCount", { length: 20 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type AiUsageTracking = typeof aiUsageTracking.$inferSelect;
export type InsertAiUsageTracking = typeof aiUsageTracking.$inferInsert;

/**
 * Section comments table - stores comments on translation sections
 */
export const sectionComments = mysqlTable("sectionComments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookId: varchar("bookId", { length: 64 }).notNull(),
  sectionId: varchar("sectionId", { length: 64 }).notNull(),
  userId: varchar("userId", { length: 64 }).notNull(),
  content: longtext("content").notNull(),
  resolved: mysqlEnum("resolved", ["open", "resolved"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type SectionComment = typeof sectionComments.$inferSelect;
export type InsertSectionComment = typeof sectionComments.$inferInsert;


/**
 * Section data table - comprehensive table for all section-related information
 * Consolidates drafts, metadata, translation status, and content in one place
 */
export const sectionData = mysqlTable("sectionData", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookId: varchar("bookId", { length: 64 }).notNull(),
  sectionId: varchar("sectionId", { length: 64 }).notNull(),
  // Original content
  originalContent: longtext("originalContent").notNull(),
  startLine: varchar("startLine", { length: 20 }).notNull(),
  endLine: varchar("endLine", { length: 20 }).notNull(),
  sectionType: mysqlEnum("sectionType", ["paragraph", "heading", "code", "list"]).notNull(),
  // Draft translation
  draftTranslation: longtext("draftTranslation"),
  draftSource: longtext("draftSource"),
  // Translation status
  translationStatus: mysqlEnum("translationStatus", ["not_translated", "draft", "committed"]).default("not_translated").notNull(),
  // Committed translation (final version in Git)
  committedTranslation: longtext("committedTranslation"),
  // Metadata
  lastModified: timestamp("lastModified").defaultNow(),
  draftLastModified: timestamp("draftLastModified"),
  committedAt: timestamp("committedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type SectionData = typeof sectionData.$inferSelect;
export type InsertSectionData = typeof sectionData.$inferInsert;
