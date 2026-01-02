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
 * Ensures slugs are consistent for ID generation and username fields
 */
function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

/**
 * Loads the user-defined lookup table (Key=Value or Key=0)
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
 * Normalizes a date string to Year-Month-Day-Hour format for hourly comparison
 * Example: 2026-01-02T13:45:00Z -> 2026-0-2-13
 */
function getHourlyKey(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}`;
}

async function runImport() {
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(10); 

  const filePath = './fb_posts.json';
  const lookupFilePath = './extracted_inkers_lookup.txt';
  
  if (!fs.existsSync(filePath)) return console.error("❌ fb_posts.json not found.");

  const posts = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const lookupTable = loadLookupTable(lookupFilePath);
  
  // --- PHASE 0: PRE-FETCH EXISTING DATA ---
  console.log("🔍 Fetching existing data from Sanity...");
  
  const uniqueInkersMap = new Map(); // Name -> Sanity ID
  const existingArticlesSet = new Set(); // Stores "Title|HourlyKey"

  try {
    // Fetch Inkers for exact name matching
    const existingInkers = await client.fetch('*[_type == "inker"]{_id, name}');
    existingInkers.forEach(inker => {
      if (inker.name) uniqueInkersMap.set(inker.name.trim(), inker._id);
    });

    // Fetch Articles for deduplication
    const existingDocs = await client.fetch('*[_type == "article"]{title, publishedAt}');
    existingDocs.forEach(doc => {
      const hourlyKey = getHourlyKey(doc.publishedAt);
      if (doc.title && hourlyKey) {
        existingArticlesSet.add(`${doc.title.trim()}|${hourlyKey}`);
      }
    });

    console.log(`ℹ️ Cached ${uniqueInkersMap.size} Inkers and ${existingArticlesSet.size} Articles.`);
  } catch (err) {
    console.error("⚠️ Pre-fetch failed:", err.message);
  }

  // --- PHASE 1: IDENTIFY AND CREATE MISSING INKERS ---
  const inkersToCreate = new Set();
  posts.forEach(post => {
    if (Array.isArray(post.inkersOnDuty)) {
      post.inkersOnDuty.forEach(name => {
        const trimmed = name.trim();
        const finalName = lookupTable.has(trimmed) ? lookupTable.get(trimmed) : trimmed;
        if (finalName !== '0' && finalName && !uniqueInkersMap.has(finalName)) {
          inkersToCreate.add(finalName);
        }
      });
    }
  });

  if (inkersToCreate.size > 0) {
    const inkerNames = Array.from(inkersToCreate);
    const inkerBar = new ProgressBar('👤 Syncing Inkers [:bar] :percent', { total: inkerNames.length, width: 20 });

    await Promise.all(inkerNames.map(name => limit(async () => {
      const inkerId = `inker-${slugify(name)}`;
      const inkerDoc = {
        _type: 'inker',
        name: name,
        username: { _type: 'slug', current: slugify(name) }
      };

      const createdInker = await client.createOrReplace({ _id: inkerId, ...inkerDoc });
      uniqueInkersMap.set(name, createdInker._id);
      inkerBar.tick();
    })));
  }

  // --- PHASE 2: UPLOAD ARTICLES WITH DEDUPLICATION ---
  console.log(`🚀 Migrating ${posts.length} articles...`);
  const articleBar = new ProgressBar('📦 Articles [:bar] :percent :etas', { total: posts.length, width: 40 });

  const processArticle = async (post, index) => {
    const slug = post.linkName?.current || `post-${index}`;
    
    // --- DEDUPLICATION CHECK ---
    const currentHourlyKey = getHourlyKey(post.publishedAt);
    const duplicateKey = `${post.title?.trim()}|${currentHourlyKey}`;

    if (existingArticlesSet.has(duplicateKey)) {
      articleBar.tick();
      return; // Skip this article
    }

    // --- CONVERT NAMES TO REFERENCES ---
    const references = [];
    if (Array.isArray(post.inkersOnDuty)) {
      post.inkersOnDuty.forEach(name => {
        const trimmed = name.trim();
        const finalName = lookupTable.has(trimmed) ? lookupTable.get(trimmed) : trimmed;
        
        if (finalName !== '0' && uniqueInkersMap.has(finalName)) {
          references.push({
            _key: `ref-${Math.random().toString(36).substr(2, 9)}`,
            _type: 'reference',
            _ref: uniqueInkersMap.get(finalName)
          });
        }
      });
    }

    try {
      let imageAssetId = null;
      if (post.image?.localPath && fs.existsSync(post.image.localPath)) {
        const asset = await client.assets.upload('image', fs.createReadStream(post.image.localPath));
        imageAssetId = asset._id;
        fs.unlinkSync(post.image.localPath); 
      }

      const doc = {
        _type: 'article',
        title: post.title,
        publishedAt: post.publishedAt,
        type: post.type,
        linkName: post.linkName,
        body: post.body,
        inkersOnDuty: references,
      };

      if (imageAssetId) {
        doc.image = { _type: 'image', asset: { _type: 'reference', _ref: imageAssetId } };
      }

      await client.createOrReplace({ _id: `fb-post-${slug}`, ...doc });
      
      // Update our local duplicate set to handle duplicates within the JSON file itself
      existingArticlesSet.add(duplicateKey);
      
      articleBar.tick();
    } catch (err) {
      console.error(`\n❌ Error [${slug}]: ${err.message}`);
    }
  };

  await Promise.all(posts.map((post, index) => limit(() => processArticle(post, index))));
  console.log(`\n✨ Migration Complete! Cleaned duplicates and linked references.`);
}

runImport();