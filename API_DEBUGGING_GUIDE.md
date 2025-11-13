# Album of the Day API Debugging Guide

## Problem Summary

The Album of the Day Slack bot is failing because the API endpoints are returning 500 Internal Server Errors:
- `/api/feed/json` - Returns `{"error":"Internal server error"}`
- `/api/feed/atom` - Also returning 500 errors
- `/feed` (redirects to atom) - Failing

The bot worked successfully just a few days ago (Nov 11, 2025), so something changed recently in the API.

---

## Key Observations

### Working Example (Nov 11, 2025)
```
📡 Fetching album feed from: https://albumoftheday.netlify.app/api/feed/json
📚 Found 10 albums in feed
🎵 Found album: "Blue" by Joni Mitchell (2025-11-11)
✅ Successfully posted to Slack and Bluesky
```

### Current Failure
```
📡 Fetching album feed from: https://albumoftheday.netlify.app/api/feed/json
❌ Error: HTTP 500: {"error":"Internal server error"}
```

---

## What to Check in album-day-app Repository

### 1. Recent Changes to API Routes

**Files to examine:**
- Look for API route handlers for `/api/feed/json` and `/api/feed/atom`
- Check for recent commits that modified feed generation
- Common locations:
  - `pages/api/feed/json.js` or `pages/api/feed/json.ts`
  - `pages/api/feed/atom.js` or `pages/api/feed/atom.ts`
  - `app/api/feed/json/route.js` (if using Next.js App Router)
  - `netlify/functions/` directory (if using Netlify Functions)

**What to look for:**
- Recent commits in the last week
- Changes to database queries
- Changes to data transformation/mapping
- New dependencies or imports that might be failing

### 2. Database/Data Source Issues

**Check for:**
- Database connection failures
- Missing environment variables (check Netlify dashboard)
- Schema changes that broke queries
- Missing or changed fields in the album data structure

**Questions to answer:**
- Is the data source accessible?
- Did the database schema change?
- Are all required environment variables set in Netlify?

### 3. API Key Authentication

The bot sends an `X-API-Key` header with requests:
```javascript
options.headers["X-API-Key"] = ALBUM_API_KEY;
```

**Check for:**
- Recent changes to API key validation logic
- Changes to authentication middleware
- The API key validation might be throwing errors instead of returning 403

**Look in:**
- Middleware files
- Authentication logic in API routes
- Environment variable configuration in Netlify

### 4. Error Handling and Logging

**Check for:**
- Try-catch blocks that might be swallowing the real error
- Generic error handlers that return `{"error":"Internal server error"}`
- Look for actual error logs in:
  - Netlify Function logs
  - Netlify deploy logs
  - Any error tracking service (Sentry, etc.)

**Example problematic pattern:**
```javascript
try {
  // ... feed generation
} catch (error) {
  // This hides the real error!
  return res.status(500).json({ error: "Internal server error" });
}
```

**Better pattern:**
```javascript
try {
  // ... feed generation
} catch (error) {
  console.error("Feed generation error:", error);
  return res.status(500).json({
    error: "Internal server error",
    details: error.message // Or at least log it
  });
}
```

### 5. Dependencies and Imports

**Check for:**
- Recently added npm packages that might be failing
- Import statements that reference moved/deleted files
- Breaking changes in dependency updates
- Check `package.json` and recent `package-lock.json` changes

### 6. Data Structure Changes

**Compare working vs broken:**
- The bot expects this structure:
```javascript
{
  "items": [
    {
      "id": "album-2025-11-11-...",
      "title": "Blue by Joni Mitchell",
      "image": "http://coverartarchive.org/...",
      "_album": {
        "id": "...",
        "scheduledDate": "2025-11-11",
        "artist": "Joni Mitchell",
        "album": "Blue",
        "year": 1971,
        "genres": [...],
        "tags": [...]
      }
    }
  ]
}
```

**Look for:**
- Changes to how `_album` object is constructed
- Changes to date formatting (`scheduledDate`)
- Missing required fields

### 7. Netlify-Specific Issues

**Check in Netlify Dashboard:**
- Recent deployments and their status
- Function logs for actual error messages
- Environment variables are correctly set
- Build logs for any warnings/errors
- Function timeout settings (might be timing out)

**Netlify locations to check:**
- Site settings → Environment variables
- Functions → Function logs (real-time)
- Deploys → Deploy logs

### 8. Content Management System (CMS)

If you're using a CMS (Contentful, Sanity, Airtable, etc.):

**Check for:**
- CMS API rate limits
- Changes to CMS schema/content model
- CMS API key expiration
- Changes to how album data is fetched from CMS

---

## Debugging Steps

### Step 1: Check Netlify Function Logs
1. Go to Netlify dashboard
2. Navigate to Functions
3. Look for the feed API function
4. Check real-time logs for actual error messages

### Step 2: Check Recent Git History
```bash
cd album-day-app
git log --oneline --since="7 days ago" -- "**/*feed*" "**/*api*"
```

### Step 3: Test Locally
```bash
npm run dev
curl http://localhost:3000/api/feed/json
```

### Step 4: Add Detailed Error Logging
Temporarily update the API route to log full errors:
```javascript
catch (error) {
  console.error("FULL ERROR:", error);
  console.error("ERROR STACK:", error.stack);
  console.error("ERROR MESSAGE:", error.message);
  return res.status(500).json({ error: "Internal server error" });
}
```

Then redeploy and check Netlify logs.

---

## Quick Wins to Try

### 1. Rollback Recent Deploy
If there's a recent deploy, try rolling back in Netlify:
- Deploys → Click on a working deploy → "Publish deploy"

### 2. Check for Missing Environment Variables
Compare environment variables between:
- Local `.env` file
- Netlify environment variables
- GitHub Actions secrets

### 3. Verify API Route Still Exists
Make sure the route files weren't accidentally deleted or moved.

---

## Expected Fix Priority

1. **Highest**: Check Netlify function logs for actual error
2. **High**: Review recent commits to feed API code
3. **High**: Verify environment variables in Netlify
4. **Medium**: Check database/CMS connectivity
5. **Medium**: Test feed generation locally
6. **Low**: Check for dependency issues

---

## Once Fixed

After fixing the API, the bot should automatically recover on the next scheduled run (14:15 UTC daily) thanks to the retry logic we added. The bot now:
- Retries API calls 3 times with exponential backoff
- Logs detailed error information
- Shows which API key is being used

You can also manually trigger the GitHub Action to test immediately.
