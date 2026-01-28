const fs = require('fs');
const path = require('path');
const { createClient } = require('@sanity/client');

// --- Configuration ---
const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const ARTIFACT_DIR = './public/published-papers';
const TEMPLATE_PATH = './build/template-published-papers.html';
const FIREBASE_CONFIG_PATH = './firebase.json';

function treatHTMLStrings(str) {
    return str.replace(/"/g, "&quot;");
}

//----

async function buildPublishedPapers() {
    try {
        // --- Phase 1: Retrieve and Generate HTML ---
        console.log('Fetching published papers from Sanity...');
        const publishedPapers = await client.fetch(`
            *[_type == "publishedPaper"] {
                title,
                subtitle,
                "linkName": linkName.current,
                pages[]{
                    asset->{
                        _id,
                        url
                    },
                }
            }
        `);
        
        if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

        const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

        publishedPapers.forEach(publishedPaper => {
            const htmlContent = handleEdits(template, publishedPaper);

            const filePath = path.join(ARTIFACT_DIR, `${publishedPaper.linkName}.html`);
            fs.writeFileSync(filePath, htmlContent);
            console.log(`Generated: ${publishedPaper.linkName}.html`);
        });

        console.log('Updating Firebase rewrites...');
        const firebaseConfig = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8'));

        const publishedPaperRewrites = publishedPapers.map(publishedPaper => ({
            source: `/published-papers/${publishedPaper.linkName}`,
            destination: `/published-papers/${publishedPaper.linkName}.html`
        }));

        const otherRewrites = firebaseConfig.hosting.rewrites.filter(r => !r.destination.startsWith('/published-papers/'));
        
        firebaseConfig.hosting.rewrites = [...publishedPaperRewrites, ...otherRewrites];

        fs.writeFileSync(FIREBASE_CONFIG_PATH, JSON.stringify(firebaseConfig, null, 2));
        console.log(`Processed ${publishedPapers.length} published papers`)
        console.log('firebase.json updated successfully.');

    } catch (err) {
        console.error('Error during build:', err);
        process.exit(1);
    }
}

//---

function handleEdits(template, publishedPaper) {
    template = editSEO(template, publishedPaper);

    return template;
}

function editSEO(template, publishedPaper) {
    const url = `https://themaroon.ink/published-papers/${treatHTMLStrings(publishedPaper.linkName)}`;
    const title = treatHTMLStrings(publishedPaper.title);
    const description = treatHTMLStrings(publishedPaper.subtitle ?? `Read more about the published paper: "${publishedPaper.title}" at The Maroon Ink`);
    const image = treatHTMLStrings(publishedPaper.pages[0]?.asset?.url ?? '/src/images/banner.jpg');

    template = template.replace(/{{SEOUrl}}/g, url)
    .replace(/{{SEOTitle}}/g, title)
    .replace(/{{SEODescription}}/g, description)
    .replace(/{{SEOImage}}/g, image);

    return template;
}

buildPublishedPapers().then(() => {
    console.log('All tasks completed successfully.');
});

