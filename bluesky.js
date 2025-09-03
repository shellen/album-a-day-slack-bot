#!/usr/bin/env node

/**
 * Bluesky posting functionality for Album of the Day Bot
 * 
 * Handles authentication and posting to Bluesky via the AT Protocol
 */

const { BskyAgent } = require('@atproto/api');

// Configuration from environment variables
const BLUESKY_HANDLE = process.env.BLUESKY_HANDLE;
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD; // App Password

// Function to create authenticated Bluesky agent
async function createBlueskyAgent() {
  if (!BLUESKY_HANDLE || !BLUESKY_PASSWORD) {
    throw new Error('BLUESKY_HANDLE and BLUESKY_PASSWORD environment variables are required');
  }

  const agent = new BskyAgent({
    service: 'https://bsky.social'
  });

  try {
    await agent.login({
      identifier: BLUESKY_HANDLE,
      password: BLUESKY_PASSWORD
    });
    
    console.log(`🦋 Successfully authenticated with Bluesky as @${BLUESKY_HANDLE}`);
    return agent;
  } catch (error) {
    throw new Error(`Bluesky authentication failed: ${error.message}`);
  }
}

// Function to format album data for Bluesky post
function formatBlueskyPost(albumItem) {
  const album = albumItem._album;
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Los_Angeles'
  });
  const isToday = album.scheduledDate === today;

  // Create post text with music emoji and streaming links
  const albumText = `🎧 ${isToday ? "Today's" : "Featured"} album:
${album.album} by ${album.artist}${album.year ? ` (${album.year})` : ""}

🎵 Listen on Spotify: https://open.spotify.com/search/${encodeURIComponent(`${album.artist} ${album.album}`)}
📱 Apple Music: https://music.apple.com/search?term=${encodeURIComponent(`${album.artist} ${album.album}`)}
▶️ YouTube: https://www.youtube.com/results?search_query=${encodeURIComponent(`${album.artist} ${album.album}`)}

#AlbumOfTheDay #Music`;

  return {
    text: albumText,
    createdAt: new Date().toISOString()
  };
}

// Function to post to Bluesky
async function postToBluesky(albumItem) {
  try {
    console.log('🦋 Preparing to post to Bluesky...');
    
    const agent = await createBlueskyAgent();
    const postData = formatBlueskyPost(albumItem);
    
    // Ensure post is within Bluesky's 300 character limit
    if (postData.text.length > 300) {
      console.log(`⚠️  Post too long (${postData.text.length} chars), truncating...`);
      postData.text = postData.text.substring(0, 297) + '...';
    }
    
    console.log(`📝 Post content (${postData.text.length} chars):`);
    console.log(postData.text);
    
    const response = await agent.post(postData);
    
    if (response && response.uri) {
      console.log('✅ Successfully posted to Bluesky!');
      console.log(`🔗 Post URI: ${response.uri}`);
      return response;
    } else {
      throw new Error('Failed to get response from Bluesky API');
    }
  } catch (error) {
    console.error('❌ Bluesky posting failed:', error.message);
    throw error;
  }
}

module.exports = {
  postToBluesky,
  formatBlueskyPost,
  createBlueskyAgent
};