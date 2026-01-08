import { createClient } from '@sanity/client';
import fs from 'fs';
import path from 'path';
import ProgressBar from 'progress';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_AUTH_TOKEN, 
  apiVersion: '2024-01-01',
  useCdn: false,
});

/**
 * Normalizes text for comparison to prevent duplicates
 */
function fingerprintTitle(text) {
  if (!text) return "";
  return text.toString().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Creates Sanity-friendly slugs
 */
function slugify(text) {
  return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

/**
 * Loads the name correction/mapping table
 */
function loadLookupTable(filePath) {
  const lookup = new Map();
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      if (line.includes('=')) {
        const [key, value] = line.split('=');
        lookup.set(key.trim(), value.trim());
      }
    });
  }
  return lookup;
}

/**
 * Groups posts by hour for strict deduplication
 */
function getHourlyKey(dateString) {
  try {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().substring(0, 13);
  } catch (e) { return null; }
}

async function runImport() {
  // Dynamic import for p-limit to handle rate limiting
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(10); 

  const filePath = './fb_posts.json';
  const lookupFilePath = './extracted_inkers_lookup.txt';
  
  if (!fs.existsSync(filePath)) return console.error("❌ fb_posts.json not found.");

  const posts = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const lookupTable = loadLookupTable(lookupFilePath);
  
  console.log("🔍 Syncing with Sanity Cloud...");
  const uniqueInkersMap = new Map(); 
  const existingArticlesSet = new Set(); 

  try {
    const existingInkers = await client.fetch('*[_type == "inker"]{_id, name}');
    existingInkers.forEach(i => i.name && uniqueInkersMap.set(i.name.trim(), i._id));

    const existingDocs = await client.fetch('*[_type == "article"]{title, publishedAt}');
    existingDocs.forEach(doc => {
      const hKey = getHourlyKey(doc.publishedAt);
      const fTitle = fingerprintTitle(doc.title);
      if (fTitle && hKey) existingArticlesSet.add(`${fTitle}|${hKey}`);
    });
    console.log(`✅ Cache Loaded: ${uniqueInkersMap.size} Inkers, ${existingArticlesSet.size} Articles.`);
  } catch (err) {
    console.error("⚠️ Failed to reach Sanity:", err.message);
  }

  // --- PHASE 1: SYNC INKERS ---
  const inkersToCreate = new Set();
  posts.forEach(post => {
    if (Array.isArray(post.inkersOnDuty)) {
      post.inkersOnDuty.forEach(name => {
        const trimmed = name.trim();
        const finalName = lookupTable.has(trimmed) ? lookupTable.get(trimmed) : trimmed;
        if (finalName !== '0' && finalName && !uniqueInkersMap.has(finalName)) inkersToCreate.add(finalName);
      });
    }
  });

  if (inkersToCreate.size > 0) {
    const inkerNames = Array.from(inkersToCreate);
    const inkerBar = new ProgressBar('👤 Syncing Inkers [:bar]', { total: inkerNames.length });
    await Promise.all(inkerNames.map(name => limit(async () => {
      const inkerId = `inker-${slugify(name)}`;
      const created = await client.createOrReplace({ 
        _id: inkerId, _type: 'inker', name, username: { _type: 'slug', current: slugify(name) } 
      });
      uniqueInkersMap.set(name, created._id);
      inkerBar.tick();
    })));
  }

  // --- PHASE 2: UPLOAD ARTICLES ---
  console.log(`🚀 Processing ${posts.length} local articles...`);
  let skipCount = 0;
  let uploadCount = 0;
  const articleBar = new ProgressBar('📦 Progress [:bar] :percent :current/:total', { total: posts.length, width: 40 });

  const processArticle = async (post, index) => {
    const fTitle = fingerprintTitle(post.title);
    const hKey = getHourlyKey(post.publishedAt);
    const duplicateKey = `${fTitle}|${hKey}`;

    if (existingArticlesSet.has(duplicateKey)) {
      skipCount++; articleBar.tick(); return; 
    }

    const slug = post.linkName?.current || `post-${index}`;
    
    // Convert names to Sanity references
    const references = (post.inkersOnDuty || []).map(name => {
      const finalName = lookupTable.has(name.trim()) ? lookupTable.get(name.trim()) : name.trim();
      if (finalName !== '0' && uniqueInkersMap.has(finalName)) {
        return { 
          _key: Math.random().toString(36).substring(2, 11), 
          _type: 'reference', 
          _ref: uniqueInkersMap.get(finalName) 
        };
      }
      return null;
    }).filter(Boolean);

    try {
      const sanityMediaGallery = [];

      // --- MULTI-MEDIA UPLOAD LOGIC ---
      if (Array.isArray(post.media)) {
        for (const item of post.media) {
          if (item.localPath && fs.existsSync(item.localPath)) {
            // assetType must be 'image' or 'file' (for videos)
            const assetType = item.type === 'video' ? 'file' : 'image';
            
            const asset = await client.assets.upload(assetType, fs.createReadStream(item.localPath), {
              filename: path.basename(item.localPath)
            });

            sanityMediaGallery.push({
              _key: Math.random().toString(36).substring(2, 11),
              _type: item.type === 'video' ? 'file' : 'image',
              asset: { _type: 'reference', _ref: asset._id }
            });

            // Optional: Remove local file after successful upload to save space
            fs.unlinkSync(item.localPath);
          }
        }
      }

      const doc = {
        _type: 'article',
        title: post.title,
        publishedAt: post.publishedAt,
        type: post.type,
        linkName: post.linkName,
        fbLink: post.fbLink,
        body: post.body,
        inkersOnDuty: references,
        media: sanityMediaGallery,
      };

      await client.createOrReplace({ _id: `fb-post-${slug}`, ...doc });
      
      existingArticlesSet.add(duplicateKey);
      uploadCount++; 
      articleBar.tick();
    } catch (err) {
      console.error(`\n❌ Error [${slug}]: ${err.message}`);
    }
  };

  await Promise.all(posts.map((post, index) => limit(() => processArticle(post, index))));
  
  console.log(`\n--- Summary ---`);
  console.log(`✅ Uploaded: ${uploadCount}`);
  console.log(`⏭️ Skipped (Duplicates): ${skipCount}`);
  console.log(`✨ Migration Finished.`);
}

runImport();