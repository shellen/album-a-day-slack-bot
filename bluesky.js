#!/usr/bin/env node

/**
 * Bluesky posting functionality for Album of the Day Bot
 * 
 * Handles authentication and posting to Bluesky via the AT Protocol
 */

const { BskyAgent } = require('@atproto/api');
const https = require("https");
const http = require("http");
const { URL } = require("url");

// Configuration from environment variables
const BLUESKY_HANDLE = process.env.BLUESKY_HANDLE;
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD; // App Password
const ALBUM_FEED_URL = process.env.ALBUM_FEED_URL || "https://albumoftheday.netlify.app/api/feed/json";
const ALBUM_API_KEY = process.env.ALBUM_API_KEY;

// Utility function for HTTP requests with retry logic
async function httpsGet(url, additionalHeaders = {}, retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await httpsGetAttempt(url, additionalHeaders, attempt);
      return result;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const is500Error = error.message.includes('HTTP 500') || error.message.includes('HTTP 502') || error.message.includes('HTTP 503');

      if (is500Error && !isLastAttempt) {
        console.log(`⚠️  API returned ${error.message.match(/HTTP \d+/)?.[0]} (attempt ${attempt}/${retries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

// Helper function for a single HTTP GET attempt
function httpsGetAttempt(url, additionalHeaders = {}, attemptNumber = 1) {
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
    if (ALBUM_API_KEY && (url.includes("albumoftheday.netlify.app") || url.includes("localhost"))) {
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
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            console.error(`❌ Failed to parse JSON response: ${error.message}`);
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          console.error(`❌ API error - Status: ${res.statusCode}, Response: ${data}`);
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

// Function to download image as buffer for Bluesky upload
async function downloadImage(imageUrl) {
  if (!imageUrl) return null;
  
  try {
    const urlObj = new URL(imageUrl);
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

    const requestModule = isHttps ? https : http;
    
    return new Promise((resolve, reject) => {
      const req = requestModule.request(options, (res) => {
        // Handle redirects (301, 302, 307, 308)
        if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
          console.log(`🔄 Following redirect to: ${res.headers.location}`);
          return downloadImage(res.headers.location).then(resolve).catch(reject);
        }
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const buffer = Buffer.concat(chunks);
            const mimeType = res.headers['content-type'] || 'image/jpeg';
            resolve({ buffer, mimeType });
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on("error", reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
      
      req.end();
    });
  } catch (error) {
    console.log(`⚠️  Error downloading image: ${error.message}`);
    return null;
  }
}

// Helper to create rich text with facets for links
function createRichText(text, links) {
  const facets = [];
  
  // Find each link in the text and create facets
  links.forEach(({ label, url }) => {
    const linkText = `[${label}]`;
    const linkIndex = text.indexOf(linkText);
    
    if (linkIndex !== -1) {
      // Convert character positions to byte positions
      const textUpToLink = text.substring(0, linkIndex);
      const byteStart = Buffer.byteLength(textUpToLink, 'utf8');
      const byteEnd = byteStart + Buffer.byteLength(linkText, 'utf8');
      
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }]
      });
    }
  });
  
  return { text: text, facets: facets.length > 0 ? facets : undefined };
}

// Function to create smart Bluesky post that fits character limit
async function formatBlueskyPost(albumItem) {
  const album = albumItem._album;
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Los_Angeles'
  });
  const isToday = album.scheduledDate === today;

  // Base content
  const header = `🎧 ${isToday ? "Today's" : "Featured"} album:`;
  const albumInfo = `${album.album} by ${album.artist}${album.year ? ` (${album.year})` : ""}`;
  const hashtags = `#AlbumOfTheDay`;
  
  // Build sections in priority order
  const sections = [];
  sections.push(`${header}\n${albumInfo}`);
  
  // Create clean streaming links with labels (using shortest possible URLs)
  const searchQuery = encodeURIComponent(`${album.artist} ${album.album}`);
  
  // Get Wikipedia URL (try API first, fallback to search)
  let wikipediaUrl = await getTopWikipediaUrl(album.album, album.artist);
  if (!wikipediaUrl) {
    const wikipediaQuery = encodeURIComponent(`${album.album} ${album.artist}`);
    wikipediaUrl = `https://en.wikipedia.org/wiki/Special:Search/${wikipediaQuery}`;
  }
  
  // Define content in priority order (highest to lowest)
  const baseContent = `${header}\n${albumInfo}`;
  
  // Create rich text links with facets for better formatting
  const linkData = [
    { label: "Spotify", url: `https://open.spotify.com/search/${searchQuery}` },
    { label: "Apple", url: `https://music.apple.com/search?term=${searchQuery}` },
    { label: "YouTube", url: `https://music.youtube.com/search?q=${searchQuery}` },
    { label: "Wikipedia", url: wikipediaUrl }
  ];
  
  const links = [
    `🎵 [Spotify]`,
    `📱 [Apple]`,
    `▶️ [YouTube]`,
    `📖 [Wikipedia]`
  ];
  
  // Try different combinations starting with everything, then remove lowest priority items
  const attempts = [
    // Full version with hashtag
    { content: baseContent, links: links, hashtag: hashtags },
    // Drop hashtag first
    { content: baseContent, links: links, hashtag: '' },
    // Drop Wikipedia next (lowest priority link)
    { content: baseContent, links: links.slice(0, 3), hashtag: '' },
    // Drop YouTube if still too long
    { content: baseContent, links: links.slice(0, 2), hashtag: '' },
    // Drop Apple if still too long
    { content: baseContent, links: links.slice(0, 1), hashtag: '' },
    // Just album info and Spotify as absolute minimum
    { content: baseContent, links: [links[0]], hashtag: '' }
  ];
  
  let postText = '';
  for (const attempt of attempts) {
    const linksText = attempt.links.length > 0 ? `\n${attempt.links.join(' • ')}` : '';
    const hashtagText = attempt.hashtag ? `\n\n${attempt.hashtag}` : '';
    const testText = `${attempt.content}${linksText}${hashtagText}`;
    
    if (testText.length <= 300) {
      postText = testText;
      break;
    }
  }
  
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

  // Create rich text with facets for the final post
  const linksInPost = [];
  linkData.forEach((linkInfo, index) => {
    if (postText.includes(`[${linkInfo.label}]`)) {
      linksInPost.push(linkInfo);
    }
  });
  
  const richText = createRichText(postText, linksInPost);
  
  return {
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString()
  };
}

// Function to post to Bluesky with image
async function postToBluesky(albumItem) {
  try {
    console.log('🦋 Preparing to post to Bluesky...');
    
    const agent = await createBlueskyAgent();
    const postData = await formatBlueskyPost(albumItem);
    
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
    
    // Try to add album artwork
    let embed = null;
    if (albumItem.image) {
      try {
        console.log(`🖼️  Downloading album artwork from: ${albumItem.image}`);
        const imageData = await downloadImage(albumItem.image);
        
        if (imageData) {
          console.log(`📤 Uploading album artwork (${imageData.mimeType}, ${imageData.buffer.length} bytes)...`);
          const uploadResult = await agent.uploadBlob(imageData.buffer, {
            encoding: imageData.mimeType
          });
          
          console.log(`📤 Upload result:`, JSON.stringify(uploadResult.data, null, 2));
          
          const album = albumItem._album;
          embed = {
            $type: 'app.bsky.embed.images',
            images: [{
              alt: `${album.album} by ${album.artist} album cover`,
              image: uploadResult.data.blob
            }]
          };
          
          console.log('✅ Album artwork uploaded successfully');
          console.log('🖼️  Embed object:', JSON.stringify(embed, null, 2));
        } else {
          console.log('⚠️  Image download returned null');
        }
      } catch (imageError) {
        console.log(`❌ Failed to add album artwork: ${imageError.message}`);
        console.log(`❌ Full error:`, imageError);
        // Continue without image - don't fail the entire post
      }
    } else {
      console.log('📷 No image URL provided in albumItem');
    }
    
    // Create final post with optional image embed and rich text facets
    const finalPost = {
      text: postData.text,
      createdAt: postData.createdAt,
      ...(postData.facets && { facets: postData.facets }),
      ...(embed && { embed })
    };
    
    const response = await agent.post(finalPost);
    
    if (response && response.uri) {
      console.log('✅ Successfully posted to Bluesky!');
      if (embed) {
        console.log('🖼️  Post includes album artwork');
      }
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
  createBlueskyAgent,
  downloadImage
};