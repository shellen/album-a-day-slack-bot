#!/usr/bin/env node

/**
 * Test script to generate and validate Slack payload locally
 * This helps debug the invalid_blocks error
 */

const { formatAlbumMessage } = require('./bot.js');

// Mock album data from the failing GitHub Actions run
const mockAlbumItem = {
  "id": "album-2025-11-06-z2SCOtsHVwov6iMMBpT8",
  "title": "For Your Pleasure by Roxy Music",
  "url": "https://albumoftheday.netlify.app/album/z2SCOtsHVwov6iMMBpT8",
  "external_url": "https://open.spotify.com/search/Roxy%20Music%20For%20Your%20Pleasure",
  "date_published": "2025-11-06T14:00:00.000Z",
  "date_modified": "2025-11-06T14:00:00.000Z",
  "summary": "Album of the Day for Thursday, November 6, 2025: For Your Pleasure by Roxy Music",
  "image": "http://coverartarchive.org/release/1398ad2c-5b43-41c7-9a57-cc1be79c1935/23912260764-1200.jpg",
  "tags": [
    "Art Rock",
    "Glam",
    "Glam Rock",
    "Pop Rock",
    "music",
    "album"
  ],
  "_album": {
    "id": "z2SCOtsHVwov6iMMBpT8",
    "scheduledDate": "2025-11-06",
    "artist": "Roxy Music",
    "album": "For Your Pleasure",
    "year": 1973,
    "genres": [
      "Art Rock",
      "Glam",
      "Glam Rock",
      "Pop Rock"
    ],
    "tags": []
  }
};

async function testPayload() {
  console.log('🧪 Generating Slack payload from mock data...\n');

  try {
    const slackMessage = await formatAlbumMessage(mockAlbumItem);

    console.log('✅ Payload generated successfully!\n');
    console.log('📋 Full Slack message payload:');
    console.log(JSON.stringify(slackMessage, null, 2));

    console.log('\n🔍 Validating blocks structure...');

    // Validate blocks
    if (!slackMessage.blocks || !Array.isArray(slackMessage.blocks)) {
      console.error('❌ ERROR: blocks is not an array');
      process.exit(1);
    }

    console.log(`✅ Found ${slackMessage.blocks.length} blocks`);

    // Validate each block
    slackMessage.blocks.forEach((block, index) => {
      console.log(`\n📦 Block ${index + 1}: ${block.type}`);

      // Check for empty or missing required fields
      if (!block.type) {
        console.error(`❌ ERROR: Block ${index + 1} missing 'type' field`);
      }

      if (block.type === 'section') {
        if (!block.text || !block.text.text) {
          console.error(`❌ ERROR: Section block ${index + 1} has empty text`);
        } else {
          console.log(`  ✅ Text: ${block.text.text.substring(0, 50)}...`);
        }
      }

      if (block.type === 'image') {
        if (!block.image_url) {
          console.error(`❌ ERROR: Image block ${index + 1} missing image_url`);
        } else {
          console.log(`  ✅ Image URL: ${block.image_url}`);
        }
        if (!block.alt_text) {
          console.error(`❌ ERROR: Image block ${index + 1} missing alt_text`);
        } else {
          console.log(`  ✅ Alt text: ${block.alt_text}`);
        }
      }

      if (block.type === 'context') {
        if (!block.elements || !Array.isArray(block.elements)) {
          console.error(`❌ ERROR: Context block ${index + 1} missing or invalid elements`);
        } else {
          console.log(`  ✅ Elements: ${block.elements.length} elements`);
          block.elements.forEach((el, i) => {
            if (el.type === 'mrkdwn' && (!el.text || el.text.trim() === '')) {
              console.error(`❌ ERROR: Context element ${i + 1} has empty text`);
            }
          });
        }
      }

      if (block.type === 'actions') {
        if (!block.elements || !Array.isArray(block.elements)) {
          console.error(`❌ ERROR: Actions block ${index + 1} missing or invalid elements`);
        } else {
          console.log(`  ✅ Actions: ${block.elements.length} buttons`);
          block.elements.forEach((button, i) => {
            if (!button.url) {
              console.error(`❌ ERROR: Button ${i + 1} missing URL`);
            } else {
              console.log(`    Button ${i + 1}: ${button.text?.text} -> ${button.url}`);
            }
          });
        }
      }
    });

    console.log('\n✅ Validation complete!');

  } catch (error) {
    console.error('❌ Error generating payload:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testPayload();
