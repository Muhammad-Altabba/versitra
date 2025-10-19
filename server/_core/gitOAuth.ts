import { Router } from 'express';
import { nanoid } from 'nanoid';
import { GitHubClient } from '../git/github';
import { GitLabClient } from '../git/gitlab';
import { RegistryManager } from '../git/registry';
import { upsertUser, upsertGitCredential } from '../db';
import { sdk } from './sdk';
import { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';
import { getSessionCookieOptions } from './cookies';

const router = Router();

/**
 * Debug endpoint to show OAuth configuration
 */
router.get('/oauth/debug', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${baseUrl}/api/oauth/github/callback`;
  
  res.json({
    clientId: clientId ? `${clientId.substring(0, 10)}...` : 'NOT SET',
    baseUrl,
    redirectUri,
    authUrl: `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo%20user:email&state=TEST`,
  });
});

/**
 * GitHub OAuth flow
 */
router.get('/oauth/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${baseUrl}/api/oauth/github/callback`;
  const scope = 'repo user:email';
  const state = nanoid();

  console.log('[GitHub OAuth] Client ID:', clientId);
  console.log('[GitHub OAuth] Base URL:', baseUrl);
  console.log('[GitHub OAuth] Redirect URI:', redirectUri);

  // Store state in session for CSRF protection
  req.session = req.session || {};
  req.session.oauthState = state;

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scope)}&state=${state}`;

  console.log('[GitHub OAuth] Auth URL:', authUrl);

  res.redirect(authUrl);
});

router.get('/oauth/github/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify state for CSRF protection
  if (!req.session?.oauthState || req.session.oauthState !== state) {
    return res.status(400).send('Invalid state parameter');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('Failed to obtain access token');
    }

    const accessToken = tokenData.access_token;

    // Get user info from GitHub
    const github = new GitHubClient(accessToken);
    const githubUser = await github.getUser();

    // Create or update user in database
    const userId = `github:${githubUser.username}`;
    await upsertUser({
      id: userId,
      name: githubUser.name,
      email: githubUser.email,
      loginMethod: 'github',
    });

    // Store Git credentials
    await upsertGitCredential(
      userId,
      'github',
      githubUser.username,
      accessToken
    );

    // Register user in admin registry
    if (process.env.ADMIN_GITHUB_TOKEN) {
      try {
        const registry = new RegistryManager(process.env.ADMIN_GITHUB_TOKEN);
        await registry.addTranslator({
          username: githubUser.username,
          gitProvider: 'github',
          name: githubUser.name,
          email: githubUser.email,
        });
      } catch (error) {
        console.error('[Registry] Failed to add translator:', error);
        // Continue even if registry update fails
      }
    }

    // Create session token
    const sessionToken = await sdk.createSessionToken(userId, {
      name: githubUser.name || githubUser.username,
      expiresInMs: ONE_YEAR_MS,
    });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    // Redirect to dashboard with success message
    res.redirect('/dashboard?connected=github');
  } catch (error) {
    console.error('[OAuth] GitHub callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`/dashboard?error=${encodeURIComponent('GitHub authentication failed: ' + errorMessage)}`);
  }
});

/**
 * GitLab OAuth flow
 */
router.get('/oauth/gitlab', (req, res) => {
  const clientId = process.env.GITLAB_CLIENT_ID;
  const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${baseUrl}/api/oauth/gitlab/callback`;
  const scope = 'api read_user';
  const state = nanoid();

  // Store state in session for CSRF protection
  req.session = req.session || {};
  req.session.oauthState = state;

  const authUrl = `https://gitlab.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;

  res.redirect(authUrl);
});

router.get('/oauth/gitlab/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify state for CSRF protection
  if (!req.session?.oauthState || req.session.oauthState !== state) {
    return res.status(400).send('Invalid state parameter');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://gitlab.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`}/api/oauth/gitlab/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('Failed to obtain access token');
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Get user info from GitLab
    const gitlab = new GitLabClient(accessToken);
    const gitlabUser = await gitlab.getUser();

    // Create or update user in database
    const userId = `gitlab:${gitlabUser.username}`;
    await upsertUser({
      id: userId,
      name: gitlabUser.name,
      email: gitlabUser.email,
      loginMethod: 'gitlab',
    });

    // Store Git credentials
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;
    await upsertGitCredential(
      userId,
      'gitlab',
      gitlabUser.username,
      accessToken,
      refreshToken,
      tokenExpiresAt
    );

    // Register user in admin registry
    if (process.env.ADMIN_GITHUB_TOKEN) {
      try {
        const registry = new RegistryManager(process.env.ADMIN_GITHUB_TOKEN);
        await registry.addTranslator({
          username: gitlabUser.username,
          gitProvider: 'gitlab',
          name: gitlabUser.name,
          email: gitlabUser.email,
        });
      } catch (error) {
        console.error('[Registry] Failed to add translator:', error);
        // Continue even if registry update fails
      }
    }

    // Create session token
    const sessionToken = await sdk.createSessionToken(userId, {
      name: gitlabUser.name || gitlabUser.username,
      expiresInMs: ONE_YEAR_MS,
    });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    // Redirect to dashboard with success message
    res.redirect('/dashboard?connected=gitlab');
  } catch (error) {
    console.error('[OAuth] GitLab callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`/dashboard?error=${encodeURIComponent('GitLab authentication failed: ' + errorMessage)}`);
  }
});

export default router;

