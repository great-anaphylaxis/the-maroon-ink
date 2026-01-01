const { createClient } = require('@sanity/client');
require('dotenv').config();

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_AUTH_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

async function deleteImportedPosts() {
  try {
    // This query finds only documents created by your script
    const query = '*[_type == "article" && _id match "fb-post-*"]';
    
    console.log("🔍 Finding documents to delete...");
    
    await client.delete({ query: query })
      .then((res) => {
        console.log('🗑️ Successfully deleted imported documents');
      });
  } catch (err) {
    console.error('❌ Delete failed:', err.message);
  }
}

deleteImportedPosts();