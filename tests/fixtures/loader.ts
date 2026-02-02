import { readFileSync } from 'fs';
import { resolve } from 'path';

const fixturesDir = resolve(__dirname);

export interface DocumentFixture {
  name: string;
  content: string;
  wordCount: number;
  language: string;
}

export interface TranslationFixture {
  language_pair: string;
  difficulty: string;
  domain: string;
  direction?: string;
  translations: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

export interface UserFixture {
  id: string;
  name: string;
  email: string;
  loginMethod: string;
  role: 'user' | 'admin';
  createdAt: string;
  lastSignedIn: string;
  preferences: {
    theme: string;
    language: string;
    notifications: boolean;
  };
}

export interface ProjectFixture {
  id: string;
  userId: string;
  title: string;
  description: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: string;
  gitProvider: string;
  gitRepoUrl: string;
  gitBranch: string;
  createdAt: string;
  updatedAt: string;
  sections: Array<{
    id: string;
    sectionNumber: number;
    title: string;
    status: string;
    wordCount: number;
  }>;
  progress: {
    total: number;
    committed: number;
    draft: number;
    notTranslated: number;
    percentage: number;
  };
}

export function loadDocument(name: string): DocumentFixture {
  const content = readFileSync(
    resolve(fixturesDir, 'documents', name),
    'utf-8'
  );
  const wordCount = content.split(/\s+/).length;
  return {
    name,
    content,
    wordCount,
    language: 'en',
  };
}

export function loadTranslation(name: string): TranslationFixture {
  const data = readFileSync(
    resolve(fixturesDir, 'translations', `${name}.json`),
    'utf-8'
  );
  return JSON.parse(data);
}

export function loadUser(name: string): UserFixture {
  const data = readFileSync(
    resolve(fixturesDir, 'users', `${name}.json`),
    'utf-8'
  );
  return JSON.parse(data);
}

export function loadProject(name: string): ProjectFixture {
  const data = readFileSync(
    resolve(fixturesDir, 'projects', `${name}.json`),
    'utf-8'
  );
  return JSON.parse(data);
}

export function getDocumentPath(name: string): string {
  return resolve(fixturesDir, 'documents', name);
}

export function getTranslationCount(fixture: TranslationFixture): number {
  return fixture.translations.length;
}

export function getUserRole(fixture: UserFixture): 'user' | 'admin' {
  return fixture.role;
}

export function getProjectProgress(fixture: ProjectFixture): number {
  return fixture.progress.percentage;
}
