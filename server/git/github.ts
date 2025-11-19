import { Octokit } from '@octokit/rest';

export interface GitHubUser {
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string;
}

export interface GitHubRepo {
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
}

export interface GitHubFile {
  content: string;
  sha: string;
  path: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

/**
 * GitHub API client wrapper
 */
export class GitHubClient {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  /**
   * Get authenticated user info
   */
  async getUser(): Promise<GitHubUser> {
    const { data } = await this.octokit.users.getAuthenticated();
    return {
      username: data.login,
      name: data.name,
      email: data.email,
      avatarUrl: data.avatar_url,
    };
  }

  /**
   * Create a new repository
   */
  async createRepo(name: string, description?: string, isPrivate = true): Promise<GitHubRepo> {
    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: true, // Initialize with README
    });

    return {
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      defaultBranch: data.default_branch || 'main',
    };
  }

  /**
   * Get repository info
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const { data } = await this.octokit.repos.get({
      owner,
      repo,
    });

    return {
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      defaultBranch: data.default_branch || 'main',
    };
  }

  /**
   * Get file content from repository
   */
  async getFile(owner: string, repo: string, path: string, branch = 'main'): Promise<GitHubFile | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if ('content' in data && data.type === 'file') {
        return {
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
          sha: data.sha,
          path: data.path,
        };
      }

      return null;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a file in repository
   */
  async commitFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch = 'main',
    sha?: string
  ): Promise<void> {
    console.log(`[GitHub.commitFile] Committing file to ${owner}/${repo}`, {
      path,
      branch,
      contentSize: content.length,
      hasSha: !!sha,
    });

    // If SHA not provided, try to get existing file SHA
    let fileSha = sha;
    if (!fileSha) {
      try {
        const existing = await this.getFile(owner, repo, path, branch);
        if (existing) {
          fileSha = existing.sha;
          console.log(`[GitHub.commitFile] Found existing file SHA: ${fileSha.substring(0, 7)}`);
        }
      } catch (e) {
        // File doesn't exist, that's fine for new files
        console.log(`[GitHub.commitFile] File does not exist yet (new file): ${path}`);
      }
    }

    try {
      await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content, 'utf-8').toString('base64'),
        branch,
        sha: fileSha, // Required for updates
      });
      console.log(`[GitHub.commitFile] ✅ Successfully committed ${path} to ${owner}/${repo}`);
    } catch (error: any) {
      console.error(`[GitHub.commitFile] ❌ Error committing file:`, {
        owner,
        repo,
        path,
        branch,
        status: error.status,
        message: error.message,
        response: error.response?.data?.message,
      });
      throw error;
    }
  }

  /**
   * Get commit history
   */
  async getCommitHistory(owner: string, repo: string, path?: string, limit = 50): Promise<GitHubCommit[]> {
    console.log(`[GitHub.getCommitHistory] Fetching commits for ${owner}/${repo}`, { path, limit });
    
    try {
      const { data } = await this.octokit.repos.listCommits({
        owner,
        repo,
        path,
        per_page: limit,
      });

      console.log(`[GitHub.getCommitHistory] ✅ Found ${data.length} commits for ${owner}/${repo}`);
      if (data.length > 0) {
        console.log(`[GitHub.getCommitHistory] Latest commit:`, {
          sha: data[0].sha.substring(0, 7),
          message: data[0].commit.message.substring(0, 50),
          author: data[0].commit.author?.name,
        });
      }

      return data.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || 'Unknown',
        date: commit.commit.author?.date || new Date().toISOString(),
        url: commit.html_url,
      }));
    } catch (error: any) {
      // Repository might be empty or not exist yet
      if (error.status === 404 || error.status === 409) {
        console.log(`[GitHub.getCommitHistory] ⚠️ No commits found for ${owner}/${repo} (status: ${error.status})`);
        return [];
      }
      console.error(`[GitHub.getCommitHistory] ❌ Error fetching commits for ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  /**
   * Get diff between two commits
   */
  async getDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    const { data } = await this.octokit.repos.compareCommits({
      owner,
      repo,
      base,
      head,
      mediaType: {
        format: 'diff',
      },
    });

    return data as unknown as string;
  }

  /**
   * List all files in a directory
   */
  async listFiles(owner: string, repo: string, path = '', branch = 'main'): Promise<Array<{ name: string; path: string; type: string }>> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (Array.isArray(data)) {
        return data
          .filter(item => item.type === 'file')
          .map(item => ({
            name: item.name,
            path: item.path,
            type: item.type,
          }));
      }

      return [];
    } catch (error: any) {
      if (error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete a file from repository
   */
  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch = 'main'
  ): Promise<void> {
    await this.octokit.repos.deleteFile({
      owner,
      repo,
      path,
      message,
      sha,
      branch,
    });
  }

  /**
   * Delete entire repository
   */
  async deleteRepository(owner: string, repo: string): Promise<void> {
    await this.octokit.repos.delete({
      owner,
      repo,
    });
  }
}

