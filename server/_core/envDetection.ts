/**
 * Environment detection utility
 * Determines if the app is running in preview or production based on PUBLIC_URL
 */

export type Environment = 'preview' | 'production';

/**
 * Detect the current environment based on PUBLIC_URL
 * Preview: matches "https://3000-*.manusvm.computer" or "http://localhost:*"
 * Production: everything else
 */
export function detectEnvironment(publicUrl?: string): Environment {
  const url = publicUrl || process.env.PUBLIC_URL || '';
  
  // Preview patterns
  const previewPatterns = [
    /https:\/\/3000-.*?\.manusvm\.computer/i,
    /http:\/\/localhost:\d+/i,
    /http:\/\/127\.0\.0\.1:\d+/i,
  ];
  
  const isPreview = previewPatterns.some(pattern => pattern.test(url));
  
  return isPreview ? 'preview' : 'production';
}

/**
 * Get environment-specific OAuth credentials
 */
export function getOAuthCredentials(env: Environment) {
  if (env === 'preview') {
    return {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID_PREVIEW,
        clientSecret: process.env.GITHUB_CLIENT_SECRET_PREVIEW,
      },
      gitlab: {
        clientId: process.env.GITLAB_CLIENT_ID_PREVIEW,
        clientSecret: process.env.GITLAB_CLIENT_SECRET_PREVIEW,
      },
    };
  } else {
    return {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID_PRODUCTION,
        clientSecret: process.env.GITHUB_CLIENT_SECRET_PRODUCTION,
      },
      gitlab: {
        clientId: process.env.GITLAB_CLIENT_ID_PRODUCTION,
        clientSecret: process.env.GITLAB_CLIENT_SECRET_PRODUCTION,
      },
    };
  }
}

/**
 * Get environment-specific PUBLIC_URL
 * Ensures the URL doesn't end with a slash to prevent double slashes
 */
export function getPublicUrl(): string {
  const url = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
  // Remove trailing slash to prevent double slashes in redirect URI
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
