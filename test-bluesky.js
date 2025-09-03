#!/usr/bin/env node

/**
 * Test script for Album of the Day Bluesky Bot
 *
 * This script tests the Bluesky functionality without actually posting.
 * It fetches the album data and shows how the Bluesky post would be formatted.
 */

const { formatBlueskyPost } = require("./bluesky.js");
const { getPacificDateString } = require("./bot.js");
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
        "User-Agent": "Album-of-the-Day-Bluesky-Test/1.0",
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

async function runBlueskyTest() {
  try {
    console.log("🦋 Testing Album of the Day Bluesky Bot");
    console.log("=======================================");

    if (ALBUM_API_KEY) {
      console.log(`✅ API Key provided: ${ALBUM_API_KEY.slice(0, 8)}...`);
      console.log(`📡 Fetching album feed from: ${ALBUM_FEED_URL}`);
      
      // Fetch the JSON feed
      var feed = await httpsGet(ALBUM_FEED_URL);
    } else {
      console.log("❌ No API key provided - using mock data for testing format");
      
      // Create mock feed data for testing
      var feed = {
        items: [{
          _album: {
            album: "The Dark Side of the Moon",
            artist: "Pink Floyd", 
            year: 1973,
            scheduledDate: new Date().toLocaleDateString('en-CA', {
              timeZone: 'America/Los_Angeles'
            })
          },
          image: "https://example.com/album-cover.jpg"
        }]
      };
    }

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

    // Format the Bluesky post
    const blueskyPost = await formatBlueskyPost(targetAlbum);

    console.log("\n📝 Formatted Bluesky Post:");
    console.log("==========================");
    console.log(`Character count: ${blueskyPost.text.length}/300`);
    console.log(`Created at: ${blueskyPost.createdAt}`);

    console.log("\n🦋 Preview (as it would appear on Bluesky):");
    console.log("==========================================");
    console.log(blueskyPost.text);
    

    if (blueskyPost.text.length > 300) {
      console.log("\n⚠️  WARNING: Post exceeds Bluesky's 300 character limit!");
      console.log("   The post will be automatically truncated when posted.");
    } else if (blueskyPost.text.length > 250) {
      console.log("\n⚠️  Note: Post is close to Bluesky's 300 character limit.");
    } else {
      console.log(`\n✅ Post length is good (${blueskyPost.text.length} characters)`);
    }

    console.log("\n✅ Bluesky test completed successfully!");
    console.log(
      "💡 If this looks correct, your bot is ready to post to Bluesky."
    );
    console.log("💡 Set POST_TO_BLUESKY=true to enable Bluesky posting in production.");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);

    if (error.message.includes("API key")) {
      console.log(
        "\n💡 Tip: Make sure you have set the ALBUM_API_KEY environment variable"
      );
      console.log("   Contact the Album of the Day team to request an API key");
    }

    if (error.message.includes("Bluesky")) {
      console.log(
        "\n💡 Note: This test only checks post formatting, not Bluesky authentication"
      );
      console.log("   BLUESKY_HANDLE and BLUESKY_PASSWORD are not required for this test");
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
  runBlueskyTest();
}

module.exports = { runBlueskyTest };