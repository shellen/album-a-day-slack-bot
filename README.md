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
- **Automatic daily posting** at your preferred time (customizable)

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

**⚠️ Note**: The admin interface is not yet ready for external API consumers. Stay tuned for updates, or contact **@shellen** for API access in the meantime.

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

By default, the bot runs at **6:15 AM Pacific Time** daily. You can easily customize this to any time that works for your timezone - see the **Customization** section below.

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

Edit the `schedule` section in `.github/workflows/album-bot.yml`:

```yaml
schedule:
  # Replace with your preferred time (all times in UTC)
  # Examples:
  - cron: "0 21 * * *"   # 9:00 PM GMT / 4:00 PM EST / 1:00 PM PST
  - cron: "0 13 * * *"   # 8:00 AM EST / 5:00 AM PST  
  - cron: "0 9 * * *"    # 10:00 AM CET / 4:00 AM EST
```

**Tip:** Use [crontab.guru](https://crontab.guru) to generate cron expressions for your timezone.

**Common times:**
- **9:00 PM GMT**: `"0 21 * * *"`
- **8:00 AM EST**: `"0 13 * * *"`
- **10:00 AM CET**: `"0 9 * * *"`
- **7:00 AM PST**: `"0 15 * * *"`

### Modify message format

Edit `formatAlbumMessage()` in `bot.js`

### Add streaming services

The bot automatically includes any streaming links from the Album of the Day feed

## 🌐 API Integration

This bot consumes the JSON Feed from Album of the Day:

- **Endpoint**: `https://albumoftheday.netlify.app/api/feed/json`
- **Format**: JSON Feed 1.1 standard
- **Updates**: Daily with new albums
- **Authentication**: Requires API key for external access (contact **@shellen** for access)
- **Rate Limiting**: 100 requests per hour per API key
- **Key Format**: `aotd_` prefix followed by 32 random characters

## 🤝 Contributing

Contributions welcome! Please open an issue or PR for:

- New streaming service integrations
- Message format improvements
- Additional notification platforms
- Timezone/scheduling improvements
- Bug fixes

For questions or API access, contact **@shellen**.

## 📄 License

MIT License - feel free to fork and customize for your community!

## 🔗 Related

- [Album of the Day](https://albumoftheday.netlify.app) - The source website
- [JSON Feed](https://jsonfeed.org) - Feed format specification

---

**Made with ❤️ for music communities**
