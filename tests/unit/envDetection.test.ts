import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectEnvironment, getOAuthCredentials, getPublicUrl } from '../../server/_core/envDetection';

describe('Environment Detection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('detectEnvironment', () => {
    it('should detect preview environment from manusvm.computer URL', () => {
      const url = 'https://3000-abc123.manusvm.computer';
      const env = detectEnvironment(url);
      expect(env).toBe('preview');
    });

    it('should detect preview environment from localhost URL', () => {
      const url = 'http://localhost:3000';
      const env = detectEnvironment(url);
      expect(env).toBe('preview');
    });

    it('should detect preview environment from 127.0.0.1 URL', () => {
      const url = 'http://127.0.0.1:3000';
      const env = detectEnvironment(url);
      expect(env).toBe('preview');
    });

    it('should detect production environment from manus.space URL', () => {
      const url = 'https://gittrans-azjknxsl.manus.space';
      const env = detectEnvironment(url);
      expect(env).toBe('production');
    });

    it('should detect production environment from custom domain', () => {
      const url = 'https://example.com';
      const env = detectEnvironment(url);
      expect(env).toBe('production');
    });

    it('should use PUBLIC_URL env var when no URL provided', () => {
      process.env.PUBLIC_URL = 'https://3000-xyz789.manusvm.computer';
      const env = detectEnvironment();
      expect(env).toBe('preview');
    });

    it('should handle case-insensitive URLs', () => {
      const url = 'HTTPS://3000-ABC123.MANUSVM.COMPUTER';
      const env = detectEnvironment(url);
      expect(env).toBe('preview');
    });
  });

  describe('getOAuthCredentials', () => {
    it('should return preview credentials when environment is preview', () => {
      process.env.GITHUB_CLIENT_ID_PREVIEW = 'preview-github-id';
      process.env.GITHUB_CLIENT_SECRET_PREVIEW = 'preview-github-secret';
      process.env.GITLAB_CLIENT_ID_PREVIEW = 'preview-gitlab-id';
      process.env.GITLAB_CLIENT_SECRET_PREVIEW = 'preview-gitlab-secret';

      const credentials = getOAuthCredentials('preview');
      expect(credentials.github.clientId).toBe('preview-github-id');
      expect(credentials.github.clientSecret).toBe('preview-github-secret');
      expect(credentials.gitlab.clientId).toBe('preview-gitlab-id');
      expect(credentials.gitlab.clientSecret).toBe('preview-gitlab-secret');
    });

    it('should return production credentials when environment is production', () => {
      process.env.GITHUB_CLIENT_ID_PRODUCTION = 'prod-github-id';
      process.env.GITHUB_CLIENT_SECRET_PRODUCTION = 'prod-github-secret';
      process.env.GITLAB_CLIENT_ID_PRODUCTION = 'prod-gitlab-id';
      process.env.GITLAB_CLIENT_SECRET_PRODUCTION = 'prod-gitlab-secret';

      const credentials = getOAuthCredentials('production');
      expect(credentials.github.clientId).toBe('prod-github-id');
      expect(credentials.github.clientSecret).toBe('prod-github-secret');
      expect(credentials.gitlab.clientId).toBe('prod-gitlab-id');
      expect(credentials.gitlab.clientSecret).toBe('prod-gitlab-secret');
    });

    it('should return credentials object for preview environment', () => {
      const credentials = getOAuthCredentials('preview');
      expect(credentials.github).toBeDefined();
      expect(credentials.gitlab).toBeDefined();
    });
  });

  describe('getPublicUrl', () => {
    it('should return PUBLIC_URL env var when set', () => {
      process.env.PUBLIC_URL = 'https://example.com';
      const url = getPublicUrl();
      expect(url).toBe('https://example.com');
    });

    it('should return localhost URL when PUBLIC_URL is not set', () => {
      delete process.env.PUBLIC_URL;
      process.env.PORT = '3000';
      const url = getPublicUrl();
      expect(url).toBe('http://localhost:3000');
    });

    it('should use default port 3000 when PORT is not set', () => {
      delete process.env.PUBLIC_URL;
      delete process.env.PORT;
      const url = getPublicUrl();
      expect(url).toBe('http://localhost:3000');
    });
  });

  describe('Integration: Environment detection with credentials', () => {
    it('should return correct preview credentials based on preview URL', () => {
      process.env.PUBLIC_URL = 'https://3000-test.manusvm.computer';
      process.env.GITHUB_CLIENT_ID_PREVIEW = 'preview-id';
      process.env.GITHUB_CLIENT_SECRET_PREVIEW = 'preview-secret';

      const env = detectEnvironment();
      const credentials = getOAuthCredentials(env);

      expect(env).toBe('preview');
      expect(credentials.github.clientId).toBe('preview-id');
      expect(credentials.github.clientSecret).toBe('preview-secret');
    });

    it('should return correct production credentials based on production URL', () => {
      process.env.PUBLIC_URL = 'https://gittrans-azjknxsl.manus.space';
      process.env.GITHUB_CLIENT_ID_PRODUCTION = 'prod-id';
      process.env.GITHUB_CLIENT_SECRET_PRODUCTION = 'prod-secret';

      const env = detectEnvironment();
      const credentials = getOAuthCredentials(env);

      expect(env).toBe('production');
      expect(credentials.github.clientId).toBe('prod-id');
      expect(credentials.github.clientSecret).toBe('prod-secret');
    });
  });
});
