/**
 * Common types and interfaces for Git clients
 */

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface GitFile {
  content: string;
  sha: string;
  path: string;
}

export interface GitFileInfo {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

/**
 * Common interface for Git operations
 * Note: commitFile has different signatures for GitHub vs GitLab,
 * so we don't include it in the base interface.
 */
export interface GitClient {
  /**
   * Get file content from repository
   */
  getFile(
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<GitFile | null>;

  /**
   * Get commit history for a repository or file
   */
  getCommitHistory(
    owner: string,
    repo: string,
    path?: string,
    limit?: number
  ): Promise<GitCommit[]>;

  /**
   * List files in a directory
   */
  listFiles(
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<GitFileInfo[]>;

  /**
   * Delete a repository
   */
  deleteRepository(owner: string, repo: string): Promise<void>;
}

/**
 * Type-safe wrapper for GitHub-specific operations
 */
export interface GitHubClientInterface extends GitClient {
  commitFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string,
    sha?: string
  ): Promise<void>;
}

/**
 * Type-safe wrapper for GitLab-specific operations
 */
export interface GitLabClientInterface extends GitClient {
  commitFile(
    projectId: string,
    path: string,
    content: string,
    message: string,
    branch?: string,
    isUpdate?: boolean
  ): Promise<void>;
}
