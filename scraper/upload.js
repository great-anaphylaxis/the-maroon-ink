const { createClient } = require('@sanity/client');
const fs = require('fs');
const path = require('path');
const ProgressBar = require('progress');
require('dotenv').config();

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_AUTH_TOKEN, 
  apiVersion: '2024-01-01',
  useCdn: false,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runImport() {
  const filePath = './fb_posts.json';
  const startTime = Date.now();
  
  console.log('-------------------------------------------------------');
  console.log(`[${new Date().toLocaleTimeString()}] 🔍 Initializing Migration...`);
  console.log(`📍 Project ID: ${process.env.SANITY_PROJECT_ID}`);
  console.log(`📍 Dataset:    ${process.env.SANITY_DATASET}`);
  console.log('-------------------------------------------------------');

  if (!fs.existsSync(filePath)) {
    console.error("❌ FATAL ERROR: fb_posts.json not found. Did the Python scraper run successfully?");
    return;
  }

  const posts = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const totalPosts = posts.length;
  console.log(`✅ Loaded ${totalPosts} posts from JSON.`);

  const bar = new ProgressBar('🚀 Overall Progress [:bar] :percent :etas', {
    total: totalPosts,
    width: 30,
    complete: '=',
    incomplete: ' '
  });

  for (let i = 0; i < totalPosts; i++) {
    const post = posts[i];
    const postNum = i + 1;
    const slug = post.linkName?.current || 'no-slug';

    console.log(`\n[${postNum}/${totalPosts}] 📝 Processing: "${post.title}"`);
    console.log(`   🔗 Slug: ${slug}`);

    try {
      let imageAssetId = null;
      const imgPath = post.image?.localPath;

      // --- STEP 1: IMAGE UPLOAD ---
      if (imgPath && fs.existsSync(imgPath)) {
        const stats = fs.statSync(imgPath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`   📸 Found local image: ${path.basename(imgPath)} (${fileSizeInMB} MB)`);
        console.log(`   ⏳ Uploading to Sanity Content Lake...`);
        
        const asset = await client.assets.upload('image', fs.createReadStream(imgPath), {
          filename: path.basename(imgPath),
          contentType: 'image/jpeg',
          label: `Facebook Import: ${slug}`
        });

        imageAssetId = asset._id;
        console.log(`   ✅ Asset Uploaded! ID: ${imageAssetId}`);
      } else if (imgPath) {
        console.warn(`   ⚠️ Warning: Image path defined but file missing at ${imgPath}`);
      } else {
        console.log(`   ℹ️ No image associated with this post.`);
      }

      // --- STEP 2: DOCUMENT SYNC ---
      const doc = {
        _type: 'article',
        title: post.title,
        publishedAt: post.publishedAt,
        type: post.type,
        linkName: post.linkName,
        body: post.body,
      };

      if (imageAssetId) {
        doc.image = {
          _type: 'image',
          asset: { _type: 'reference', _ref: imageAssetId }
        };
      }

      console.log(`   ☁️ Syncing document to Sanity...`);
      const result = await client.createOrReplace({
        _id: `fb-post-${slug}`, 
        ...doc
      });
      console.log(`   ✅ Success! Sanity Document ID: ${result._id}`);

      // --- STEP 3: CLEANUP ---
      if (imgPath && fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
        console.log(`   🗑️ Local file deleted: ${path.basename(imgPath)}`);
      }

      // --- STEP 4: THROTTLING ---
      console.log(`   💤 Throttling... (200ms delay)`);
      await sleep(200);
      
      bar.tick();

    } catch (err) {
      console.error(`   ❌ ERROR at post "${post.title}":`, err.message);
      console.log(`   💤 Cooling down for 2 seconds before retry...`);
      await sleep(2000); 
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=======================================================');
  console.log(`✨ MIGRATION COMPLETE!`);
  console.log(`⏱️ Total Duration: ${duration} seconds`);
  console.log(`📄 Total Documents: ${totalPosts}`);
  console.log('=======================================================');
}

runImport();