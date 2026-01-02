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

async function runImport() {
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(10); 

  const filePath = './fb_posts.json';
  const lookupFilePath = './extracted_inkers_lookup.txt';
  
  if (!fs.existsSync(filePath)) return console.error("❌ fb_posts.json not found.");

  const posts = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const lookupTable = loadLookupTable(lookupFilePath);
  
  // --- PHASE 0: PRE-FETCH EXISTING INKERS BY EXACT NAME ---
  console.log("🔍 Fetching existing Inkers from Sanity for exact name matching...");
  const uniqueInkersMap = new Map(); // Exact Name -> Sanity ID

  try {
    // We query all documents of type 'inker' regardless of ID prefix 
    // to ensure we catch manually created ones too.
    const existingInkers = await client.fetch('*[_type == "inker"]{_id, name}');
    
    existingInkers.forEach(inker => {
      if (inker.name) {
        // Map the exact name to the ID found in Sanity
        uniqueInkersMap.set(inker.name.trim(), inker._id);
      }
    });
    console.log(`ℹ️ Found ${uniqueInkersMap.size} existing inker profiles in Sanity.`);
  } catch (err) {
    console.error("⚠️ Failed to fetch existing inkers:", err.message);
  }

  // --- PHASE 1: IDENTIFY AND CREATE MISSING INKERS ---
  const inkersToCreate = new Set();
  
  posts.forEach(post => {
    if (Array.isArray(post.inkersOnDuty)) {
      post.inkersOnDuty.forEach(name => {
        const trimmed = name.trim();
        // 1. Apply lookup rules
        const finalName = lookupTable.has(trimmed) ? lookupTable.get(trimmed) : trimmed;
        
        // 2. Filter blocklist and check if exact name exists in our fetched map
        if (finalName !== '0' && finalName && !uniqueInkersMap.has(finalName)) {
          inkersToCreate.add(finalName);
        }
      });
    }
  });

  if (inkersToCreate.size > 0) {
    const inkerNames = Array.from(inkersToCreate);
    const inkerBar = new ProgressBar('👤 Creating New Inkers [:bar] :percent', { total: inkerNames.length, width: 20 });

    await Promise.all(inkerNames.map(name => limit(async () => {
      const inkerId = `inker-${slugify(name)}`;
      const inkerDoc = {
        _type: 'inker',
        name: name, // The complete exact name
        username: { _type: 'slug', current: slugify(name) }
      };

      // createOrReplace uses the inkerId to prevent duplicates if the script is interrupted
      const createdInker = await client.createOrReplace({ _id: inkerId, ...inkerDoc });
      uniqueInkersMap.set(name, createdInker._id);
      inkerBar.tick();
    })));
  } else {
    console.log("✅ No new inkers to create. All names matched existing records.");
  }

  // --- PHASE 2: UPLOAD ARTICLES WITH RELATIONAL REFERENCES ---
  console.log(`🚀 Migrating ${posts.length} articles...`);
  const articleBar = new ProgressBar('📦 Articles [:bar] :percent :etas', { total: posts.length, width: 40 });

  const processArticle = async (post, index) => {
    const slug = post.linkName?.current || `post-${index}`;
    
    const references = [];
    if (Array.isArray(post.inkersOnDuty)) {
      post.inkersOnDuty.forEach(name => {
        const trimmed = name.trim();
        const finalName = lookupTable.has(trimmed) ? lookupTable.get(trimmed) : trimmed;
        
        // Match against the map (which now contains both pre-fetched and newly created IDs)
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
        inkersOnDuty: references, // Relational references to Inker documents
      };

      if (imageAssetId) {
        doc.image = { _type: 'image', asset: { _type: 'reference', _ref: imageAssetId } };
      }

      await client.createOrReplace({ _id: `fb-post-${slug}`, ...doc });
      articleBar.tick();
    } catch (err) {
      console.error(`\n❌ Error [${slug}]: ${err.message}`);
    }
  };

  await Promise.all(posts.map((post, index) => limit(() => processArticle(post, index))));
  console.log(`\n✨ Migration Complete! References are successfully linked.`);
}

runImport();