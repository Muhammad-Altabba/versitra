import { Gitlab } from '@gitbeaker/rest';

export interface GitLabUser {
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string;
}

export interface GitLabRepo {
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
}

export interface GitLabFile {
  content: string;
  sha: string;
  path: string;
}

export interface GitLabCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

/**
 * GitLab API client wrapper
 */
export class GitLabClient {
  private gitlab: InstanceType<typeof Gitlab>;

  constructor(accessToken: string, host = 'https://gitlab.com') {
    this.gitlab = new Gitlab({
      host,
      token: accessToken,
    });
  }

  /**
   * Get authenticated user info
   */
  async getUser(): Promise<GitLabUser> {
    const user: any = await this.gitlab.Users.showCurrentUser();
    return {
      username: String(user.username),
      name: user.name ? String(user.name) : null,
      email: user.email ? String(user.email) : null,
      avatarUrl: String(user.avatar_url || ''),
    };
  }

  /**
   * Create a new project (repository)
   */
  async createRepo(name: string, description?: string, isPrivate = true): Promise<GitLabRepo> {
    const project: any = await this.gitlab.Projects.create({
      name,
      description,
      visibility: isPrivate ? 'private' : 'public',
      initializeWithReadme: true,
    });

    return {
      name: String(project.name),
      fullName: String(project.path_with_namespace),
      url: String(project.web_url),
      defaultBranch: String(project.default_branch || 'main'),
    };
  }

  /**
   * Get project info
   */
  async getRepo(projectId: string): Promise<GitLabRepo> {
    const project: any = await this.gitlab.Projects.show(projectId);

    return {
      name: String(project.name),
      fullName: String(project.path_with_namespace),
      url: String(project.web_url),
      defaultBranch: String(project.default_branch || 'main'),
    };
  }

  /**
   * Get file content from repository
   */
  async getFile(projectId: string, path: string, branch = 'main'): Promise<GitLabFile | null> {
    try {
      const file: any = await this.gitlab.RepositoryFiles.show(projectId, path, branch);

      return {
        content: Buffer.from(String(file.content), 'base64').toString('utf-8'),
        sha: String(file.blob_id || ''),
        path: String(file.file_path),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a file in repository
   */
  async commitFile(
    projectId: string,
    path: string,
    content: string,
    message: string,
    branch = 'main',
    isUpdate = false
  ): Promise<void> {
    // Auto-detect if file exists
    const existing = await this.getFile(projectId, path, branch);
    
    if (existing) {
      await this.gitlab.RepositoryFiles.edit(projectId, path, branch, content, message);
    } else {
      await this.gitlab.RepositoryFiles.create(projectId, path, branch, content, message);
    }
  }

  /**
   * Get commit history
   */
  async getCommitHistory(projectId: string, path?: string, limit = 50): Promise<GitLabCommit[]> {
    const commits = await this.gitlab.Commits.all(projectId, {
      path,
      perPage: limit,
    });

    return commits.map((commit: any) => ({
      sha: String(commit.id),
      message: String(commit.message),
      author: String(commit.author_name || 'Unknown'),
      date: String(commit.created_at),
      url: String(commit.web_url || ''),
    }));
  }

  /**
   * Get diff between two commits
   */
  async getDiff(projectId: string, base: string, head: string): Promise<string> {
    const compare = await this.gitlab.Repositories.compare(projectId, base, head);
    
    // Combine all diffs into a single string
    if (compare.diffs && Array.isArray(compare.diffs)) {
      return compare.diffs.map((diff: any) => diff.diff || '').join('\n\n');
    }
    return '';
  }

  /**
   * List all files in a directory
   */
  async listFiles(projectId: string, path = '', branch = 'main'): Promise<Array<{ name: string; path: string; type: string }>> {
    try {
      const tree = await this.gitlab.Repositories.allRepositoryTrees(projectId, {
        path,
        ref: branch,
        recursive: false,
      });

      return tree
        .filter(item => item.type === 'blob')
        .map(item => ({
          name: item.name,
          path: item.path,
          type: 'file',
        }));
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete a file from repository
   */
  async deleteFile(
    projectId: string,
    path: string,
    message: string,
    branch = 'main'
  ): Promise<void> {
    await this.gitlab.RepositoryFiles.remove(projectId, path, branch, message);
  }
}

