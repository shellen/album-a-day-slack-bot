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
const { postToBluesky } = require("./bluesky");

// Configuration from environment variables
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "#general";
const ALBUM_FEED_URL =
  process.env.ALBUM_FEED_URL ||
  "https://albumoftheday.netlify.app/api/feed/json";
const ALBUM_API_KEY = process.env.ALBUM_API_KEY; // Required for external access
const TARGET_DATE = process.env.TARGET_DATE; // Optional: specific date to fetch
const POST_TO_BLUESKY = process.env.POST_TO_BLUESKY === 'true'; // Optional: enable Bluesky posting

// Utility function to make HTTP/HTTPS requests
function httpsGet(url, additionalHeaders = {}) {
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
        ...additionalHeaders,
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

// Function to test if an image URL is accessible
async function testImageUrl(imageUrl) {
  return new Promise((resolve) => {
    const urlObj = new URL(imageUrl);
    const isHttps = urlObj.protocol === "https:";
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "HEAD",
      timeout: 5000,
      headers: {
        "User-Agent": "Album-of-the-Day-Bot/1.0",
      },
    };

    const requestModule = isHttps ? https : http;
    const req = requestModule.request(options, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Function to validate and optimize image URL for Slack mobile compatibility
async function validateAndOptimizeImageUrl(imageUrl) {
  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl);
    
    if (url.protocol !== 'https:') {
      console.log(`⚠️  Converting HTTP to HTTPS for mobile compatibility: ${imageUrl}`);
      url.protocol = 'https:';
    }

    if (url.hostname === 'coverartarchive.org') {
      const optimizedUrl = url.toString().replace('-1200.jpg', '-500.jpg');
      if (optimizedUrl !== url.toString()) {
        console.log(`📱 Testing optimized Cover Art Archive image: ${optimizedUrl}`);
        const isOptimizedAvailable = await testImageUrl(optimizedUrl);
        if (isOptimizedAvailable) {
          console.log(`✅ Using 500px version for mobile optimization`);
          return optimizedUrl;
        } else {
          console.log(`⚠️  500px version not available, falling back to original`);
          return url.toString();
        }
      }
      return url.toString();
    }

    if (url.hostname === 'i.scdn.co') {
      return url.toString();
    }

    if (url.hostname.includes('mzstatic.com') || url.hostname.includes('itunes.apple.com')) {
      return url.toString();
    }

    console.log(`📱 Using image from domain: ${url.hostname}`);
    return url.toString();
  } catch (error) {
    console.log(`⚠️  Invalid image URL: ${imageUrl}`);
    return null;
  }
}

// Function to get direct Wikipedia URL using our centralized API
async function getTopWikipediaUrl(album, artist) {
  try {
    const baseUrl = ALBUM_FEED_URL.includes('localhost') 
      ? 'http://localhost:3000' 
      : 'https://albumoftheday.netlify.app';
    
    const wikipediaUrl = `${baseUrl}/api/wikipedia?album=${encodeURIComponent(album)}&artist=${encodeURIComponent(artist)}`;
    
    const response = await httpsGet(wikipediaUrl);
    
    if (response && response.url) {
      return response.url;
    }
    return null;
  } catch (error) {
    console.log(`⚠️  Wikipedia API error: ${error.message}`);
    return null;
  }
}

// Function to format the album for Slack
async function formatAlbumMessage(albumItem) {
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

  // Add Wikipedia button using our centralized API
  let wikipediaUrl = await getTopWikipediaUrl(album.album, album.artist);
  
  if (!wikipediaUrl) {
    const fallbackQuery = encodeURIComponent(
      `${album.album} ${album.artist} album`
    );
    wikipediaUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${fallbackQuery}`;
    console.log(`📖 Using Wikipedia search fallback: ${wikipediaUrl}`);
  } else {
    console.log(`📖 Found Wikipedia article: ${wikipediaUrl}`);
  }

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
  const optimizedImageUrl = await validateAndOptimizeImageUrl(albumItem.image);
  
  if (optimizedImageUrl) {
    // Generate archive URL based on the album's scheduled date
    const archiveUrl = `https://albumoftheday.netlify.app/${album.scheduledDate.replace(
      /-/g,
      "/"
    )}`;

    console.log(`🖼️  Using optimized image URL: ${optimizedImageUrl}`);

    // Add full-width image block
    message.blocks.push({
      type: "image",
      image_url: optimizedImageUrl,
      alt_text: `${album.album} by ${album.artist} album cover`,
    });

    // Add archive link as separate context block
    message.blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${archiveUrl}|View album on Album of the Day>`,
        },
      ],
    });
  } else {
    const archiveUrl = `https://albumoftheday.netlify.app/${album.scheduledDate.replace(
      /-/g,
      "/"
    )}`;
    
    console.log(`⚠️  No valid image URL available, adding text-only archive link`);
    
    message.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${archiveUrl}|🎵 View "${album.album}" by ${album.artist} on Album Archive>`,
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

    // Debug: Log the album data structure
    console.log("🔍 Album data:", JSON.stringify(targetAlbum, null, 2));

    // Format and send to Slack
    const slackMessage = await formatAlbumMessage(targetAlbum);

    console.log(`📤 Posting to Slack channel: ${SLACK_CHANNEL}`);
    await postToSlack(SLACK_WEBHOOK_URL, slackMessage);

    console.log("✅ Successfully posted album to Slack!");

    // Post to Bluesky if enabled
    if (POST_TO_BLUESKY) {
      try {
        console.log("🦋 Bluesky posting enabled, attempting to post...");
        await postToBluesky(targetAlbum);
        console.log("✅ Successfully posted album to Bluesky!");
      } catch (blueskyError) {
        console.error("❌ Bluesky posting failed:", blueskyError.message);
        console.log(`::warning title=Bluesky Failed::${blueskyError.message}`);
        // Don't fail the entire process if Bluesky fails
      }
    } else {
      console.log("🦋 Bluesky posting disabled (set POST_TO_BLUESKY=true to enable)");
    }

    // Output for GitHub Actions
    const platforms = POST_TO_BLUESKY ? `${SLACK_CHANNEL} and Bluesky` : SLACK_CHANNEL;
    console.log(
      `::notice title=Album Posted::Posted "${album.album}" by ${album.artist} to ${platforms}`
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
