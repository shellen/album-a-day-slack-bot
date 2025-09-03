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

// Function to create smart Bluesky post that fits character limit
function formatBlueskyPost(albumItem) {
  const album = albumItem._album;
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Los_Angeles'
  });
  const isToday = album.scheduledDate === today;

  // Base content
  const header = `🎧 ${isToday ? "Today's" : "Featured"} album:`;
  const albumInfo = `${album.album} by ${album.artist}${album.year ? ` (${album.year})` : ""}`;
  const hashtags = `#AlbumOfTheDay #Music`;
  
  // Build sections in priority order
  const sections = [];
  sections.push(`${header}\n${albumInfo}`);
  
  // Create clean streaming links with labels (using shortest possible URLs)
  const searchQuery = encodeURIComponent(`${album.artist} ${album.album}`);
  const streamingLinks = [
    `[Spotify](https://open.spotify.com/search/${searchQuery})`,
    `[Apple](https://music.apple.com/search?term=${searchQuery})`, // Shorter label
    `[YouTube](https://music.youtube.com/search?q=${searchQuery})` // Shorter label  
  ];
  
  // Try to fit streaming links (prioritize fitting as many as possible)
  let postText = sections[0];
  let availableSpace = 300 - postText.length - hashtags.length - 4; // 4 chars for spacing/newlines (\n\n between links and hashtags)
  
  // Try to fit all streaming links on one line with separators
  const allLinksText = streamingLinks.join(' • ');
  
  
  if (availableSpace >= allLinksText.length + 1) { // +1 for newline
    postText += `\n${allLinksText}`;
  } else {
    // Fallback: fit as many as possible
    const fittingLinks = [];
    let remainingSpace = availableSpace - 1; // -1 for newline
    
    for (const link of streamingLinks) {
      const separator = fittingLinks.length === 0 ? '' : ' • ';
      const testLength = separator.length + link.length;
      
      if (remainingSpace >= testLength) {
        fittingLinks.push(link);
        remainingSpace -= testLength;
      }
    }
    
    if (fittingLinks.length > 0) {
      postText += `\n${fittingLinks.join(' • ')}`;
    }
  }
  
  // Add hashtags
  postText += `\n\n${hashtags}`;
  
  // Final check - if still too long, truncate smartly
  if (postText.length > 300) {
    // Remove streaming links and just keep essential info
    postText = `${sections[0]}\n\n${hashtags}`;
    
    // If still too long, truncate album info smartly
    if (postText.length > 300) {
      const maxAlbumInfoLength = 300 - header.length - hashtags.length - 6; // spacing
      if (albumInfo.length > maxAlbumInfoLength) {
        const truncatedInfo = albumInfo.substring(0, maxAlbumInfoLength - 3) + '...';
        postText = `${header}\n${truncatedInfo}\n\n${hashtags}`;
      }
    }
  }

  return {
    text: postText,
    createdAt: new Date().toISOString()
  };
}

// Function to post to Bluesky
async function postToBluesky(albumItem) {
  try {
    console.log('🦋 Preparing to post to Bluesky...');
    
    const agent = await createBlueskyAgent();
    const postData = formatBlueskyPost(albumItem);
    
    // The formatBlueskyPost function already handles character limits intelligently
    // but add a final safeguard with smart truncation
    if (postData.text.length > 300) {
      console.log(`⚠️  Post still too long (${postData.text.length} chars), applying emergency truncation...`);
      
      // Smart truncation: find the last complete word before limit
      const maxLength = 297; // Leave room for '...'
      let truncated = postData.text.substring(0, maxLength);
      
      // Find last space to avoid breaking words
      const lastSpaceIndex = truncated.lastIndexOf(' ');
      const lastNewlineIndex = truncated.lastIndexOf('\n');
      const lastBreakIndex = Math.max(lastSpaceIndex, lastNewlineIndex);
      
      if (lastBreakIndex > maxLength * 0.8) { // Only if we don't lose too much content
        truncated = postData.text.substring(0, lastBreakIndex);
      }
      
      postData.text = truncated + '...';
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