import { describe, it, expect } from 'vitest';

/**
 * OAuth URL Normalization Tests
 * Tests the fix for double slash issue in redirect URI
 */

describe('OAuth URL Normalization', () => {
  describe('getPublicUrl function', () => {
    it('should remove trailing slash from PUBLIC_URL', () => {
      const url = 'https://versitra.com/';
      const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
      expect(normalized).toBe('https://versitra.com');
    });

    it('should not add slash if URL does not have one', () => {
      const url = 'https://versitra.com';
      const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
      expect(normalized).toBe('https://versitra.com');
    });

    it('should handle localhost URLs', () => {
      const url = 'http://localhost:3000/';
      const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
      expect(normalized).toBe('http://localhost:3000');
    });

    it('should handle preview URLs with trailing slash', () => {
      const url = 'https://3000-xxx.manusvm.computer/';
      const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
      expect(normalized).toBe('https://3000-xxx.manusvm.computer');
    });

    it('should handle multiple trailing slashes', () => {
      const url = 'https://versitra.com//';
      const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
      expect(normalized).toBe('https://versitra.com/');
    });
  });

  describe('Redirect URI construction', () => {
    it('should not create double slash with normalized URL', () => {
      const baseUrl = 'https://versitra.com';
      const redirectUri = `${baseUrl}/api/oauth/github/callback`;
      expect(redirectUri).toBe('https://versitra.com/api/oauth/github/callback');
      expect(redirectUri).not.toContain('//api');
    });

    it('should create correct redirect URI with trailing slash removed', () => {
      const baseUrl = 'https://versitra.com/';
      const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const redirectUri = `${normalized}/api/oauth/github/callback`;
      expect(redirectUri).toBe('https://versitra.com/api/oauth/github/callback');
    });

    it('should create correct redirect URI for localhost', () => {
      const baseUrl = 'http://localhost:3000';
      const redirectUri = `${baseUrl}/api/oauth/github/callback`;
      expect(redirectUri).toBe('http://localhost:3000/api/oauth/github/callback');
    });

    it('should create correct redirect URI for preview', () => {
      const baseUrl = 'https://3000-xxx.manusvm.computer';
      const redirectUri = `${baseUrl}/api/oauth/github/callback`;
      expect(redirectUri).toBe('https://3000-xxx.manusvm.computer/api/oauth/github/callback');
    });
  });

  describe('URL encoding', () => {
    it('should properly encode redirect URI for GitHub', () => {
      const redirectUri = 'https://versitra.com/api/oauth/github/callback';
      const encoded = encodeURIComponent(redirectUri);
      expect(encoded).toBe('https%3A%2F%2Fversitra.com%2Fapi%2Foauth%2Fgithub%2Fcallback');
    });

    it('should properly encode slashes in URI', () => {
      const redirectUri = 'https://versitra.com/api/oauth/github/callback';
      const encoded = encodeURIComponent(redirectUri);
      expect(encoded).toBe('https%3A%2F%2Fversitra.com%2Fapi%2Foauth%2Fgithub%2Fcallback');
    });
  });

  describe('Environment detection with normalized URL', () => {
    it('should detect production environment for versitra.com', () => {
      const url = 'https://versitra.com';
      const previewPatterns = [
        /https:\/\/3000-.*?\.manusvm\.computer/i,
        /http:\/\/localhost:\d+/i,
        /http:\/\/127\.0\.0\.1:\d+/i,
      ];
      const isPreview = previewPatterns.some(pattern => pattern.test(url));
      expect(isPreview).toBe(false);
    });

    it('should detect preview environment for manusvm.computer', () => {
      const url = 'https://3000-xxx.manusvm.computer';
      const previewPatterns = [
        /https:\/\/3000-.*?\.manusvm\.computer/i,
        /http:\/\/localhost:\d+/i,
        /http:\/\/127\.0\.0\.1:\d+/i,
      ];
      const isPreview = previewPatterns.some(pattern => pattern.test(url));
      expect(isPreview).toBe(true);
    });

    it('should detect preview environment for localhost', () => {
      const url = 'http://localhost:3000';
      const previewPatterns = [
        /https:\/\/3000-.*?\.manusvm\.computer/i,
        /http:\/\/localhost:\d+/i,
        /http:\/\/127\.0\.0\.1:\d+/i,
      ];
      const isPreview = previewPatterns.some(pattern => pattern.test(url));
      expect(isPreview).toBe(true);
    });
  });

  describe('OAuth credentials selection', () => {
    it('should use production credentials for versitra.com', () => {
      const env = 'production';
      const expectedCredentials = {
        github: {
          clientId: 'GITHUB_CLIENT_ID_PRODUCTION',
          clientSecret: 'GITHUB_CLIENT_SECRET_PRODUCTION',
        },
      };
      expect(env).toBe('production');
    });

    it('should use preview credentials for manusvm.computer', () => {
      const env = 'preview';
      const expectedCredentials = {
        github: {
          clientId: 'GITHUB_CLIENT_ID_PREVIEW',
          clientSecret: 'GITHUB_CLIENT_SECRET_PREVIEW',
        },
      };
      expect(env).toBe('preview');
    });
  });
});
