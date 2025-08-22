#!/usr/bin/env node

/**
 * Test script for Album of the Day Slack Bot
 *
 * This script tests the bot functionality without actually posting to Slack.
 * It fetches the album data and shows how the message would be formatted.
 */

const { formatAlbumMessage, getPacificDateString } = require("./bot.js");
const https = require("https");
const http = require("http");
const { URL } = require("url");

// Test configuration
const ALBUM_FEED_URL =
  process.env.ALBUM_FEED_URL ||
  "https://albumoftheday.netlify.app/api/feed/json";
const ALBUM_API_KEY = process.env.ALBUM_API_KEY;
const TARGET_DATE = process.env.TARGET_DATE;

// Utility function to make HTTP/HTTPS requests (copied from bot.js)
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
        "User-Agent": "Album-of-the-Day-Bot-Test/1.0",
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

async function runTest() {
  try {
    console.log("🧪 Testing Album of the Day Slack Bot");
    console.log("=====================================");

    if (ALBUM_API_KEY) {
      console.log(`✅ API Key provided: ${ALBUM_API_KEY.slice(0, 8)}...`);
    } else {
      console.log("❌ No API key provided - this may fail for external access");
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
      console.log(`🔍 Looking for album scheduled for: ${TARGET_DATE}`);
      targetAlbum = feed.items.find(
        (item) => item._album && item._album.scheduledDate === TARGET_DATE
      );

      if (!targetAlbum) {
        throw new Error(`No album found for date: ${TARGET_DATE}`);
      }
    } else {
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
      throw new Error("No suitable album found to test");
    }

    const album = targetAlbum._album;
    console.log(
      `🎵 Found album: "${album.album}" by ${album.artist} (${album.scheduledDate})`
    );

    // Format the Slack message
    const slackMessage = formatAlbumMessage(targetAlbum);

    console.log("\n📝 Formatted Slack Message:");
    console.log("===========================");
    console.log(JSON.stringify(slackMessage, null, 2));

    console.log("\n📱 Preview (as it would appear in Slack):");
    console.log("==========================================");
    console.log(`Channel: ${slackMessage.channel}`);
    console.log(`Username: ${slackMessage.username}`);
    console.log(`Icon: ${slackMessage.icon_emoji}`);
    console.log(`\nMessage Text:\n${slackMessage.text}`);

    if (slackMessage.blocks) {
      console.log("\nBlocks:");
      slackMessage.blocks.forEach((block, i) => {
        console.log(
          `  ${i + 1}. ${block.type}:`,
          block.text?.text ||
            block.elements?.map((e) => e.text || e.type).join(", ") ||
            block.image_url ||
            "Action buttons"
        );
      });
    }

    console.log("\n✅ Test completed successfully!");
    console.log(
      "💡 If this looks correct, your bot is ready to post to Slack."
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);

    if (error.message.includes("API key")) {
      console.log(
        "\n💡 Tip: Make sure you have set the ALBUM_API_KEY environment variable"
      );
      console.log("   Contact the Album of the Day team to request an API key");
    }

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

// Run the test
if (require.main === module) {
  runTest();
}

module.exports = { runTest };
