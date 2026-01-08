import { createClient } from '@sanity/client';
import fs from 'fs';
import path from 'path';
import ProgressBar from 'progress';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_AUTH_TOKEN, 
  apiVersion: '2024-01-01',
  useCdn: false,
  timeout: 60000,
});

// --- UTILS (All Original Features Preserved) ---
function fingerprintTitle(text) {
  if (!text) return "";
  return text.toString().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function slugify(text) {
  return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

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

function getHourlyKey(dateString) {
  try {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().substring(0, 13);
  } catch (e) { return null; }
}

// --- RESILIENCE: RETRY LOGIC ---
async function uploadWithRetry(type, stream, filename, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.assets.upload(type, stream, { filename });
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      const delay = Math.pow(2, i) * 1000;
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

// --- MAIN IMPORT ---
async function runImport() {
  const { default: pLimit } = await import('p-limit');
  // High-speed concurrency: 8 simultaneous uploads
  const limit = pLimit(8); 

  const filePath = './fb_posts.json';
  const lookupFilePath = './extracted_inkers_lookup.txt';
  
  if (!fs.existsSync(filePath)) return console.error("❌ fb_posts.json not found.");

  const posts = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const lookupTable = loadLookupTable(lookupFilePath);
  
  console.log("🔍 Syncing with Sanity Cloud...");
  const uniqueInkersMap = new Map(); 
  const existingArticlesSet = new Set(); 

  // Initial Data Fetch
  try {
    const existingInkers = await client.fetch('*[_type == "inker"]{_id, name}');
    existingInkers.forEach(i => i.name && uniqueInkersMap.set(i.name.trim(), i._id));

    const existingDocs = await client.fetch('*[_type == "article"]{title, publishedAt}');
    existingDocs.forEach(doc => {
      const hKey = getHourlyKey(doc.publishedAt);
      const fTitle = fingerprintTitle(doc.title);
      if (fTitle && hKey) existingArticlesSet.add(`${fTitle}|${hKey}`);
    });
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

  // --- FILTER ONLY NEW POSTS ---
  const postsToProcess = posts.filter(post => {
    const duplicateKey = `${fingerprintTitle(post.title)}|${getHourlyKey(post.publishedAt)}`;
    return !existingArticlesSet.has(duplicateKey);
  });

  if (postsToProcess.length === 0) {
    console.log("✅ All articles are already up to date.");
    return;
  }

  // --- PHASE 2: MASS MEDIA UPLOAD (THE SPEED ZONE) ---
  const totalMediaItems = postsToProcess.reduce((sum, p) => sum + (p.media?.length || 0), 0);
  console.log(`🚀 Pre-uploading ${totalMediaItems} media assets across ${postsToProcess.length} posts...`);
  
  const mediaBar = new ProgressBar('🖼️  Media Upload [:bar] :percent :current/:total', { total: totalMediaItems, width: 40 });
  const articleMediaMap = new Map(); // Stores ready-to-use gallery objects for each post

  await Promise.all(postsToProcess.map(async (post, pIdx) => {
    if (!Array.isArray(post.media)) return;

    const postUploads = post.media.map((item) => limit(async () => {
      if (!item.localPath || !fs.existsSync(item.localPath)) return null;

      try {
        const assetType = item.type === 'video' ? 'file' : 'image';
        const mainAsset = await uploadWithRetry(assetType, fs.createReadStream(item.localPath), path.basename(item.localPath));

        const galleryItem = {
          _key: uuidv4().substring(0, 8),
          _type: item.type === 'video' ? 'file' : 'image',
          asset: { _type: 'reference', _ref: mainAsset._id }
        };

        // Handle Thumbnails
        if (item.type === 'video' && item.thumbnail && fs.existsSync(item.thumbnail)) {
          const thumbAsset = await uploadWithRetry('image', fs.createReadStream(item.thumbnail), path.basename(item.thumbnail));
          galleryItem.thumbnail = {
            _type: 'image',
            asset: { _type: 'reference', _ref: thumbAsset._id }
          };
          fs.unlinkSync(item.thumbnail);
        }

        fs.unlinkSync(item.localPath);
        mediaBar.tick();
        return galleryItem;
      } catch (e) {
        console.error(`\n❌ Failed asset: ${path.basename(item.localPath)} - ${e.message}`);
        mediaBar.tick();
        return null;
      }
    }));

    const results = await Promise.all(postUploads);
    articleMediaMap.set(pIdx, results.filter(Boolean));
  }));

  // --- PHASE 3: FINAL DOCUMENT SYNC ---
  console.log(`\n📦 Creating ${postsToProcess.length} article documents...`);
  const docBar = new ProgressBar('📝 Documents [:bar] :current/:total', { total: postsToProcess.length });

  await Promise.all(postsToProcess.map((post, pIdx) => limit(async () => {
    const slug = post.linkName?.current || `post-${pIdx}`;
    
    // Original Inker Reference Mapping
    const references = (post.inkersOnDuty || []).map(name => {
      const trimmed = name.trim();
      const finalName = lookupTable.has(trimmed) ? lookupTable.get(trimmed) : trimmed;
      if (finalName !== '0' && uniqueInkersMap.has(finalName)) {
        return { 
          _key: uuidv4().substring(0, 8), 
          _type: 'reference', 
          _ref: uniqueInkersMap.get(finalName) 
        };
      }
      return null;
    }).filter(Boolean);

    const doc = {
      _type: 'article',
      title: post.title,
      publishedAt: post.publishedAt,
      type: post.type,
      linkName: post.linkName,
      fbLink: post.fbLink,
      body: post.body,
      inkersOnDuty: references,
      media: articleMediaMap.get(pIdx) || [],
    };

    try {
      await client.createOrReplace({ _id: `fb-post-${slug}`, ...doc });
      docBar.tick();
    } catch (err) {
      console.error(`\n❌ Doc Error [${slug}]: ${err.message}`);
    }
  })));

  console.log(`\n✨ Speed Import Complete!`);
}

runImport();