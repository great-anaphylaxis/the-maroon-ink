import { createClient } from '@sanity/client';
import 'dotenv/config';

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_AUTH_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

async function deleteImportedData() {
  try {
    // This query finds articles starting with 'fb-post-' AND inkers starting with 'inker-'
    const query = '*[(_type == "article" && _id match "fb-post-*") || (_type == "inker" && _id match "inker-*")]';
    
    console.log("🔍 Finding articles and inker documents to delete...");
    
    const response = await client.delete({ query: query });
    
    console.log('🗑️ Cleanup successful!');
    console.log('Documents removed based on ID patterns: fb-post-* and inker-*');
    
  } catch (err) {
    console.error('❌ Delete failed:', err.message);
  }
}

deleteImportedData();