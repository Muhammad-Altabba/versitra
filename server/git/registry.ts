import { GitHubClient } from './github';

/**
 * Admin registry configuration
 * This should be set via environment variables
 */
const REGISTRY_CONFIG = {
  owner: 'git-translation-platform', // Platform's GitHub organization/user
  repo: 'translator-registry',
  file: 'translators.json',
  branch: 'main',
};

export interface TranslatorRecord {
  username: string;
  gitProvider: 'github' | 'gitlab';
  name: string | null;
  email: string | null;
  registeredAt: string;
}

export interface TranslatorRegistry {
  translators: TranslatorRecord[];
  lastUpdated: string;
}

/**
 * Admin registry manager
 * Tracks all translators who have logged into the platform
 */
export class RegistryManager {
  private github: GitHubClient;

  constructor(adminAccessToken: string) {
    this.github = new GitHubClient(adminAccessToken);
  }

  /**
   * Get current registry
   */
  private async getRegistry(): Promise<TranslatorRegistry> {
    const file = await this.github.getFile(
      REGISTRY_CONFIG.owner,
      REGISTRY_CONFIG.repo,
      REGISTRY_CONFIG.file,
      REGISTRY_CONFIG.branch
    );

    if (!file) {
      return {
        translators: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    try {
      return JSON.parse(file.content);
    } catch {
      return {
        translators: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Add a new translator to the registry
   */
  async addTranslator(record: Omit<TranslatorRecord, 'registeredAt'>): Promise<void> {
    const registry = await this.getRegistry();

    // Check if translator already exists
    const exists = registry.translators.some(
      t => t.username === record.username && t.gitProvider === record.gitProvider
    );

    if (exists) {
      return; // Already registered
    }

    // Add new translator
    const newRecord: TranslatorRecord = {
      ...record,
      registeredAt: new Date().toISOString(),
    };

    registry.translators.push(newRecord);
    registry.lastUpdated = new Date().toISOString();

    // Commit to registry repo
    const file = await this.github.getFile(
      REGISTRY_CONFIG.owner,
      REGISTRY_CONFIG.repo,
      REGISTRY_CONFIG.file,
      REGISTRY_CONFIG.branch
    );

    await this.github.commitFile(
      REGISTRY_CONFIG.owner,
      REGISTRY_CONFIG.repo,
      REGISTRY_CONFIG.file,
      JSON.stringify(registry, null, 2),
      `add-translator/${record.gitProvider}/${record.username}`,
      REGISTRY_CONFIG.branch,
      file?.sha
    );
  }

  /**
   * Get all registered translators
   */
  async getTranslators(): Promise<TranslatorRecord[]> {
    const registry = await this.getRegistry();
    return registry.translators;
  }

  /**
   * Check if a translator is registered
   */
  async isRegistered(username: string, gitProvider: 'github' | 'gitlab'): Promise<boolean> {
    const registry = await this.getRegistry();
    return registry.translators.some(
      t => t.username === username && t.gitProvider === gitProvider
    );
  }
}

