# Session Configuration Details

## Updated Session Middleware Configuration

Located in: `server/_core/index.ts` (lines 37-51)

```typescript
app.use(
  session({
    secret: ENV.cookieSecret,
    resave: false,
    saveUninitialized: true, // Changed to true to ensure session is created
    cookie: {
      secure: ENV.isProduction,
      httpOnly: true,
      sameSite: ENV.isProduction ? 'none' : 'lax', // Allow cross-site for OAuth
      maxAge: 1000 * 60 * 15, // 15 minutes
    },
    proxy: true, // Trust proxy headers in production
  })
);
```

## Configuration Breakdown

### 1. `secret: ENV.cookieSecret`
- **Purpose**: Used to sign the session ID cookie
- **Value**: Comes from `JWT_SECRET` environment variable
- **Security**: Ensures session cookies cannot be tampered with

### 2. `resave: false`
- **Purpose**: Don't save session if unmodified
- **Benefit**: Reduces unnecessary writes to session store
- **Recommendation**: Keep as `false` for performance

### 3. `saveUninitialized: true` ⚠️ **CHANGED**
- **Previous**: `false`
- **Current**: `true`
- **Reason**: Ensures session is created even before OAuth state is set
- **Impact**: Session cookie is sent to browser immediately, persists across OAuth redirect
- **Why needed**: OAuth flow requires session to persist from initiation to callback

### 4. Cookie Configuration

#### `secure: ENV.isProduction`
- **Development**: `false` (allows HTTP)
- **Production**: `true` (requires HTTPS)
- **Purpose**: Prevents cookie transmission over insecure connections in production

#### `httpOnly: true`
- **Purpose**: Prevents JavaScript access to cookie
- **Security**: Protects against XSS attacks
- **Impact**: Cookie only accessible via HTTP requests

#### `sameSite: ENV.isProduction ? 'none' : 'lax'` ⚠️ **CHANGED**
- **Previous**: Not set (defaults to `lax`)
- **Development**: `'lax'` - allows same-site and top-level navigation
- **Production**: `'none'` - allows cross-site requests
- **Reason**: OAuth redirects from GitHub/GitLab are cross-site
- **Security Note**: Requires `secure: true` when set to `'none'`

**SameSite Options Explained:**
- `'strict'`: Cookie only sent for same-site requests (blocks OAuth)
- `'lax'`: Cookie sent for top-level navigation (may block OAuth callbacks)
- `'none'`: Cookie sent for all requests (required for OAuth, needs HTTPS)

#### `maxAge: 1000 * 60 * 15`
- **Duration**: 15 minutes (900,000 milliseconds)
- **Purpose**: Session expires after 15 minutes of inactivity
- **Scope**: Only for OAuth state storage, not user sessions

### 5. `proxy: true` ⚠️ **CHANGED**
- **Previous**: Not set
- **Current**: `true`
- **Purpose**: Trust the first proxy in front of the application
- **Impact**: Correctly reads `X-Forwarded-*` headers
- **Why needed**: Production deployments are behind load balancers/proxies
- **Headers trusted**:
  - `X-Forwarded-For` (client IP)
  - `X-Forwarded-Proto` (HTTPS detection)
  - `X-Forwarded-Host` (original host)

## OAuth Flow with Sessions

### Step 1: User clicks "Connect GitHub"
```
GET /api/oauth/github
→ Creates session with state parameter
→ Sets session cookie in response
→ Redirects to GitHub OAuth
```

### Step 2: User authorizes on GitHub
```
User authorizes on github.com
→ Browser has session cookie from Step 1
```

### Step 3: GitHub redirects back
```
GET /api/oauth/github/callback?code=...&state=...
→ Browser sends session cookie
→ Server reads state from session
→ Validates state matches query parameter
→ Exchanges code for access token
```

## Why Previous Configuration Failed

### Problem 1: `saveUninitialized: false`
- Session not created until data is stored
- OAuth initiation didn't store data immediately
- No session cookie sent to browser
- Callback couldn't find session → "Invalid state parameter"

### Problem 2: `sameSite` not set (defaults to 'lax')
- GitHub redirect is cross-site
- Browser may not send cookie on cross-site redirect
- Session lost → "Invalid state parameter"

### Problem 3: `proxy: true` not set
- Production behind load balancer
- `req.protocol` returns 'http' instead of 'https'
- `secure: true` cookie not sent over 'http'
- Session lost → "Invalid state parameter"

## Testing the Fix

### Development Environment
```bash
# Session cookie should be:
Set-Cookie: connect.sid=...; Path=/; HttpOnly; SameSite=Lax
```

### Production Environment
```bash
# Session cookie should be:
Set-Cookie: connect.sid=...; Path=/; Secure; HttpOnly; SameSite=None
```

### Verification Steps

1. **Clear all cookies** for the domain
2. **Click "Connect GitHub"**
3. **Check browser DevTools** → Application → Cookies
4. **Verify cookie exists** with name `connect.sid`
5. **Authorize on GitHub**
6. **Check callback request** includes the cookie
7. **Should redirect** to `/dashboard?connected=github`

## Security Considerations

### ✅ Secure Aspects
- `httpOnly: true` prevents XSS cookie theft
- `secure: true` in production requires HTTPS
- `secret` signs cookies to prevent tampering
- 15-minute expiration limits attack window
- State parameter prevents CSRF

### ⚠️ Trade-offs
- `sameSite: 'none'` allows cross-site requests
  - **Mitigation**: State parameter validates request origin
  - **Mitigation**: Short session lifetime (15 min)
- `saveUninitialized: true` creates more sessions
  - **Impact**: Minimal, sessions expire in 15 minutes
  - **Mitigation**: Consider session cleanup in production

### 🔒 Production Recommendations

1. **Use session store** instead of in-memory (for multi-instance deployments)
   ```typescript
   import RedisStore from 'connect-redis';
   import { createClient } from 'redis';
   
   const redisClient = createClient();
   
   session({
     store: new RedisStore({ client: redisClient }),
     // ... other options
   })
   ```

2. **Monitor session creation rate** to detect abuse

3. **Consider shorter maxAge** (5-10 minutes) for tighter security

4. **Implement session cleanup** for expired sessions

## Environment Variables Required

| Variable | Purpose | Example |
|----------|---------|---------|
| `JWT_SECRET` | Session cookie signing | `your-secret-key-here` |
| `NODE_ENV` | Environment detection | `production` |
| `PUBLIC_URL` | OAuth redirect base URL | `https://gittrans-azjknxsl.manus.space` |

## Troubleshooting

### Still getting "Invalid state parameter"?

1. **Check cookie is set**:
   - Open DevTools → Application → Cookies
   - Look for `connect.sid` cookie
   - Verify it has `SameSite=None` and `Secure` in production

2. **Check proxy headers**:
   - Ensure load balancer sends `X-Forwarded-Proto: https`
   - Verify `X-Forwarded-Host` is correct

3. **Check session secret**:
   - Verify `JWT_SECRET` is set and consistent
   - Don't change secret between requests

4. **Check browser settings**:
   - Ensure third-party cookies are not blocked
   - Try in incognito mode to rule out extensions

5. **Check logs**:
   ```bash
   # Add debug logging
   app.use((req, res, next) => {
     console.log('Session ID:', req.sessionID);
     console.log('Session data:', req.session);
     next();
   });
   ```

## Summary of Changes

| Setting | Before | After | Reason |
|---------|--------|-------|--------|
| `saveUninitialized` | `false` | `true` | Ensure session created before OAuth |
| `sameSite` | (not set) | `'none'` in prod | Allow cross-site OAuth redirects |
| `proxy` | (not set) | `true` | Trust proxy headers for HTTPS detection |

These changes enable the OAuth flow to work correctly in production environments behind load balancers with cross-site redirects.

