#!/usr/bin/env node

/**
 * Album of the Day Slack Bot
 *
 * Fetches today's album from the Album of the Day JSON feed and posts it to Slack
 * Visit: https://albumoftheday.netlify.app
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// Configuration from environment variables
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "#general";
const ALBUM_FEED_URL =
  process.env.ALBUM_FEED_URL ||
  "https://albumoftheday.netlify.app/api/feed/json";
const ALBUM_API_KEY = process.env.ALBUM_API_KEY; // Required for external access
const TARGET_DATE = process.env.TARGET_DATE; // Optional: specific date to fetch

// Utility function to make HTTP/HTTPS requests
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: {
        "User-Agent": "Album-of-the-Day-Bot/1.0",
      },
    };

    // Add API key for Album of the Day feed requests
    if (
      ALBUM_API_KEY &&
      (url.includes("albumoftheday.netlify.app") || url.includes("localhost"))
    ) {
      options.headers["X-API-Key"] = ALBUM_API_KEY;
    }

    const requestModule = isHttps ? https : http;
    const req = requestModule.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

// Function to post message to Slack
function postToSlack(webhookUrl, message) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const postData = JSON.stringify(message);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "User-Agent": "Album-of-the-Day-Bot/1.0",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Slack API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Slack request timeout"));
    });

    req.write(postData);
    req.end();
  });
}

// Function to get Pacific date string (matching the site's logic)
function getPacificDateString(date = new Date()) {
  return date.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

// Function to format the album for Slack (matching 1001 Albums style)
function formatAlbumMessage(albumItem) {
  const album = albumItem._album;
  const today = getPacificDateString();
  const isToday = album.scheduledDate === today;

  // Create simple message text (matching 1001 Albums format)
  const messageText = `🎧 ${isToday ? "Today's" : "Featured"} album:
*${album.album}* by *${album.artist}*${album.year ? ` (${album.year})` : ""}`;

  // Build action buttons
  const buttons = [];

  // Add streaming service buttons (generate URLs since API doesn't provide them)
  const searchQuery = encodeURIComponent(`${album.artist} ${album.album}`);

  // Spotify
  buttons.push({
    type: "button",
    text: {
      type: "plain_text",
      text: "🎵 Spotify",
      emoji: true,
    },
    url: `https://open.spotify.com/search/${searchQuery}`,
  });

  // Apple Music
  buttons.push({
    type: "button",
    text: {
      type: "plain_text",
      text: "📱 Apple Music",
      emoji: true,
    },
    url: `https://music.apple.com/search?term=${searchQuery}`,
  });

  // YouTube
  buttons.push({
    type: "button",
    text: {
      type: "plain_text",
      text: "▶️ YouTube",
      emoji: true,
    },
    url: `https://www.youtube.com/results?search_query=${searchQuery}`,
  });

  // Add Wikipedia button (construct Wikipedia URL from artist and album)
  const wikipediaQuery = encodeURIComponent(
    `${album.album} ${album.artist} album`
  );
  const wikipediaUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${wikipediaQuery}`;

  buttons.push({
    type: "button",
    text: {
      type: "plain_text",
      text: "📖 Wikipedia",
      emoji: true,
    },
    url: wikipediaUrl,
  });

  // Create Slack message with clean format (like 1001 Albums)
  const message = {
    channel: SLACK_CHANNEL,
    username: "Album of the Day",
    icon_emoji: ":cd:",
    text: messageText,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: messageText,
        },
      },
    ],
  };

  // Add album artwork as a large image block that links to archive page
  if (albumItem.image) {
    // Generate archive URL based on the album's scheduled date
    const archiveUrl = `https://albumoftheday.netlify.app/${album.scheduledDate.replace(
      /-/g,
      "/"
    )}`;

    message.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${archiveUrl}|View on Album Archive>`,
      },
      accessory: {
        type: "image",
        image_url: albumItem.image,
        alt_text: `${album.album} by ${album.artist} album cover`,
      },
    });
  }

  // Add buttons as actions block
  if (buttons.length > 0) {
    message.blocks.push({
      type: "actions",
      elements: buttons,
    });
  }

  return message;
}

// Main function
async function main() {
  try {
    console.log("🤖 Album of the Day Slack Bot starting...");

    if (!SLACK_WEBHOOK_URL) {
      throw new Error("SLACK_WEBHOOK_URL environment variable is required");
    }

    if (!ALBUM_API_KEY) {
      throw new Error(
        "ALBUM_API_KEY environment variable is required for external API access"
      );
    }

    console.log(`📡 Fetching album feed from: ${ALBUM_FEED_URL}`);

    // Fetch the JSON feed
    const feed = await httpsGet(ALBUM_FEED_URL);

    if (!feed.items || feed.items.length === 0) {
      throw new Error("No albums found in feed");
    }

    console.log(`📚 Found ${feed.items.length} albums in feed`);

    // Find the target album
    let targetAlbum;

    if (TARGET_DATE) {
      // Look for specific date
      console.log(`🔍 Looking for album scheduled for: ${TARGET_DATE}`);
      targetAlbum = feed.items.find(
        (item) => item._album && item._album.scheduledDate === TARGET_DATE
      );

      if (!targetAlbum) {
        throw new Error(`No album found for date: ${TARGET_DATE}`);
      }
    } else {
      // Use today's album (first item should be most recent)
      const today = getPacificDateString();
      console.log(`🔍 Looking for today's album: ${today}`);

      targetAlbum = feed.items.find(
        (item) => item._album && item._album.scheduledDate === today
      );

      if (!targetAlbum) {
        console.log("⚠️  No album found for today, using most recent album");
        targetAlbum = feed.items[0];
      }
    }

    if (!targetAlbum) {
      throw new Error("No suitable album found to post");
    }

    const album = targetAlbum._album;
    console.log(
      `🎵 Found album: "${album.album}" by ${album.artist} (${album.scheduledDate})`
    );

    // Debug: Log the album data structure and image info
    console.log("🔍 Album data:", JSON.stringify(targetAlbum, null, 2));
    console.log("🖼️  Image field:", targetAlbum.image);
    console.log("🖼️  Image URL:", targetAlbum.image_url);
    console.log("🖼️  Content image:", targetAlbum.content_image);

    // Format and send to Slack
    const slackMessage = formatAlbumMessage(targetAlbum);

    console.log(`📤 Posting to Slack channel: ${SLACK_CHANNEL}`);
    await postToSlack(SLACK_WEBHOOK_URL, slackMessage);

    console.log("✅ Successfully posted album to Slack!");

    // Output for GitHub Actions
    console.log(
      `::notice title=Album Posted::Posted "${album.album}" by ${album.artist} to ${SLACK_CHANNEL}`
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.log(`::error title=Bot Failed::${error.message}`);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Run the bot
if (require.main === module) {
  main();
}

module.exports = { main, formatAlbumMessage, getPacificDateString };
