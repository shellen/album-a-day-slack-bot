# Album of the Day Slack Bot

🤖 A GitHub Actions bot that automatically posts daily albums from [Album of the Day](https://albumoftheday.netlify.app) to your Slack workspace.

[![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-blue?logo=github-actions)](https://github.com/features/actions)
[![Slack](https://img.shields.io/badge/Slack-Bot-4A154B?logo=slack)](https://slack.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎵 What it does

This bot fetches the daily album from the Album of the Day JSON feed and posts it to your Slack channel with:

- **Clean, minimal design**
- **Large album artwork**
- **Action buttons** for Spotify, Apple Music, YouTube, and Wikipedia
- **Automatic daily posting** at 6:15 AM Pacific

## 📱 Example Output

```
Album of the Day APP • 12:18 PM

Today's album:
**To Pimp a Butterfly** by **Kendrick Lamar** (2015)

[Large Album Artwork Image]

[Spotify] [Apple Music] [YouTube] [Wikipedia]
```

## 🚀 Quick Setup

### 1. Fork this repository

Click the "Fork" button to create your own copy.

### 2. Create a Slack webhook

1. Go to your Slack workspace settings
2. Navigate to **Apps** → **Incoming Webhooks**
3. Click **Add to Slack**
4. Choose your target channel
5. Copy the webhook URL

### 3. Request API Key

For external access to the Album of the Day feed, you'll need an API key:

1. Visit the [Album of the Day admin interface](https://albumoftheday.netlify.app/-/admin)
2. Sign in with Google (you'll need to be granted admin access)
3. Navigate to the **API Keys** tab
4. Create a new API key with a descriptive name (e.g., "My Slack Bot")
5. Copy the generated API key (format: `aotd_xxxxxxxx...`) - it will only be shown once!

### 4. Configure GitHub Secrets

In your forked repo, go to **Settings** → **Secrets and variables** → **Actions**:

**Required:**

- `SLACK_WEBHOOK_URL` - Your Slack webhook URL
- `SLACK_CHANNEL` - Channel name (e.g., `#music`)
- `ALBUM_API_KEY` - Your API key for accessing the feed (format: `aotd_xxxxxxxx...`)

**Optional:**

- `ALBUM_FEED_URL` - Custom feed URL (defaults to official site)

### 5. Enable GitHub Actions

Go to the **Actions** tab and enable workflows. The bot will start posting automatically!

## ⏰ Schedule

The bot runs at **6:15 AM Pacific Time** daily (15 minutes after new albums are available).

## 🛠️ Manual Control

### Run immediately

1. Go to **Actions** → **Album of the Day Slack Bot**
2. Click **Run workflow**
3. Optionally specify a date (YYYY-MM-DD)

### Test without posting

1. Go to **Actions** → **Test Album Bot**
2. Click **Run workflow**
3. Check logs for formatting preview

## 🧪 Local Testing

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/album-of-the-day-slack-bot.git
cd album-of-the-day-slack-bot

# Test bot formatting
npm run test

# Test with real webhook (optional)
SLACK_WEBHOOK_URL="your-webhook" npm start
```

## ⚙️ Customization

### Change posting time

Edit `.github/workflows/album-bot.yml`:

```yaml
schedule:
  - cron: "15 14 * * *" # 6:15 AM PDT (UTC-7)
  - cron: "15 13 * * *" # 6:15 AM PST (UTC-8)
```

### Modify message format

Edit `formatAlbumMessage()` in `bot.js`

### Add streaming services

The bot automatically includes any streaming links from the Album of the Day feed

## 🌐 API Integration

This bot consumes the JSON Feed from Album of the Day:

- **Endpoint**: `https://albumoftheday.netlify.app/api/feed/json`
- **Format**: JSON Feed 1.1 standard
- **Updates**: Every 6 hours with new albums
- **Authentication**: Requires API key for external access (managed via Firebase admin interface)
- **Rate Limiting**: 100 requests per hour per API key
- **Key Management**: Create, view, and revoke API keys through the admin dashboard
- **Key Format**: `aotd_` prefix followed by 32 random characters

## 🤝 Contributing

Contributions welcome! Please open an issue or PR for:

- New streaming service integrations
- Message format improvements
- Additional notification platforms
- Bug fixes

## 📄 License

MIT License - feel free to fork and customize for your community!

## 🔗 Related

- [Album of the Day](https://albumoftheday.netlify.app) - The source website
- [JSON Feed](https://jsonfeed.org) - Feed format specification

---

**Made with ❤️ for music communities**
