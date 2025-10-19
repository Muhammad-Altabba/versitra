# Deployment Configuration Guide

## OAuth Redirect URI Configuration

### Issue
GitHub and GitLab OAuth apps require exact redirect URI matches. When deploying to production, the redirect URIs must be updated in the OAuth app settings.

### Solution

#### 1. Environment Variable Configuration
The application now uses the `PUBLIC_URL` environment variable for OAuth redirects:

```bash
PUBLIC_URL=https://gittrans-azjknxsl.manus.space
```

This variable is **already configured** in the Manus deployment environment.

#### 2. GitHub OAuth App Configuration

You need to update the GitHub OAuth app settings to include the production redirect URI:

**Steps:**
1. Go to https://github.com/settings/developers
2. Click on your OAuth App (client ID: `Ov23liNP2GVcx48sLdJW`)
3. Under "Authorization callback URL", add:
   ```
   https://gittrans-azjknxsl.manus.space/api/oauth/github/callback
   ```
4. Click "Update application"

**Current Redirect URIs to Register:**
- Development: `http://3000-ir89gthjlic0z90ioijr1-b6ce4e8e.manusvm.computer/api/oauth/github/callback`
- Production: `https://gittrans-azjknxsl.manus.space/api/oauth/github/callback`

#### 3. GitLab OAuth App Configuration

Similarly, update the GitLab OAuth app settings:

**Steps:**
1. Go to https://gitlab.com/-/profile/applications
2. Find your OAuth application
3. Under "Redirect URI", add:
   ```
   https://gittrans-azjknxsl.manus.space/api/oauth/gitlab/callback
   ```
4. Click "Save application"

**Current Redirect URIs to Register:**
- Development: `http://3000-ir89gthjlic0z90ioijr1-b6ce4e8e.manusvm.computer/api/oauth/gitlab/callback`
- Production: `https://gittrans-azjknxsl.manus.space/api/oauth/gitlab/callback`

## Code Changes Made

### Updated Files
- `server/_core/gitOAuth.ts`: Now uses `PUBLIC_URL` environment variable

### Implementation
```typescript
// Before (dynamic, causes issues with proxies)
const redirectUri = `${req.protocol}://${req.get('host')}/api/oauth/github/callback`;

// After (uses PUBLIC_URL with fallback)
const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const redirectUri = `${baseUrl}/api/oauth/github/callback`;
```

## Verification Steps

After updating the OAuth app settings:

1. **Test GitHub OAuth:**
   - Visit https://gittrans-azjknxsl.manus.space/dashboard
   - Click "Connect GitHub"
   - Should redirect to GitHub authorization page
   - Should NOT show "redirect_uri is not associated" error
   - After authorization, should redirect back to dashboard with success message

2. **Test GitLab OAuth:**
   - Visit https://gittrans-azjknxsl.manus.space/dashboard
   - Click "Connect GitLab"
   - Should redirect to GitLab authorization page
   - After authorization, should redirect back to dashboard with success message

3. **Verify Database:**
   ```sql
   SELECT * FROM git_credentials WHERE gitProvider = 'github';
   SELECT * FROM git_credentials WHERE gitProvider = 'gitlab';
   ```

## Troubleshooting

### Error: "redirect_uri is not associated with this application"
**Cause:** The redirect URI in the OAuth request doesn't match any registered URIs in the OAuth app settings.

**Solution:** 
1. Check the `PUBLIC_URL` environment variable is set correctly
2. Verify the redirect URI is registered in the OAuth app settings
3. Ensure there are no trailing slashes or protocol mismatches

### Error: "Invalid state parameter"
**Cause:** CSRF state token mismatch, usually due to session issues.

**Solution:**
1. Ensure session middleware is properly configured
2. Check that cookies are being set and sent correctly
3. Verify `JWT_SECRET` environment variable is set

### Error: "Failed to obtain access token"
**Cause:** OAuth app credentials are incorrect or expired.

**Solution:**
1. Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correct
2. Verify `GITLAB_CLIENT_ID` and `GITLAB_CLIENT_SECRET` are correct
3. Check that the OAuth app is not suspended or revoked

## Security Notes

1. **HTTPS Required in Production**: OAuth providers require HTTPS for production redirect URIs
2. **Session Security**: Ensure `secure: true` for cookies in production (automatically handled)
3. **Token Encryption**: Access tokens are encrypted before database storage using AES-256-CBC
4. **CSRF Protection**: State parameter prevents cross-site request forgery attacks

## Environment Variables Summary

| Variable | Purpose | Example |
|----------|---------|---------|
| `PUBLIC_URL` | Base URL for OAuth redirects | `https://gittrans-azjknxsl.manus.space` |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | `Ov23liNP2GVcx48sLdJW` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret | `(secret)` |
| `GITLAB_CLIENT_ID` | GitLab OAuth app client ID | `(your-client-id)` |
| `GITLAB_CLIENT_SECRET` | GitLab OAuth app secret | `(secret)` |
| `JWT_SECRET` | Session signing and token encryption | `(secret)` |
| `ADMIN_GITHUB_TOKEN` | Token for admin registry updates | `(secret)` |

## Next Steps

1. ✅ Update GitHub OAuth app redirect URI
2. ✅ Update GitLab OAuth app redirect URI  
3. ✅ Test OAuth flow in production
4. ✅ Verify credentials are stored correctly
5. ✅ Test project creation after OAuth

