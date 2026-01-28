const fs = require('fs');
const path = require('path');
const { createClient } = require('@sanity/client');
const { getImageDimensions } = require('@sanity/asset-utils')
const { createImageUrlBuilder } = require('@sanity/image-url');

// --- Configuration ---
const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const ARTIFACT_DIR = './public/inkers';
const TEMPLATE_PATH = './build/template-inkers.html';
const FIREBASE_CONFIG_PATH = './firebase.json';

const builder = createImageUrlBuilder(client)
const components = {
    marks: {
        link: ({children, value}) => {
            const href = children || '';

            if (uriLooksSafe(href)) {
                return `<a href="${getValidUrl(href)}" target="_blank">${children}</a>`;
            }

            return children
        }
    }
}

function getValidUrl(url = "") {
    let newUrl = window.decodeURIComponent(url);
    newUrl = newUrl.trim().replace(/\s/g, "");

    if(/^(:\/\/)/.test(newUrl)){
        return `http${newUrl}`;
    }
    if(!/^(f|ht)tps?:\/\//i.test(newUrl)){
        return `http://${newUrl}`;
    }
    return newUrl;
}

function urlFor(source) {
    return builder.image(source);
}

function treatHTMLStrings(str) {
    return str.replace(/"/g, "&quot;");
}

//----

async function buildInkers() {
    try {
        // --- Phase 1: Retrieve and Generate HTML ---
        console.log('Fetching inkers from Sanity...');
        const inkers = await client.fetch(`
            *[_type == "inker"] {
                name,
                "username": username.current,
                profilePicture,
                role,
                bio
            }
        `);

        if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

        const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

        inkers.forEach(inker => {
            const htmlContent = handleEdits(template, inker);

            const filePath = path.join(ARTIFACT_DIR, `${inker.username}.html`);
            fs.writeFileSync(filePath, htmlContent);
            console.log(`Generated: ${inker.username}.html`);
        });

        console.log('Updating Firebase rewrites...');
        const firebaseConfig = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8'));

        const inkerRewrites = inkers.map(inker => ({
            source: `/inkers/${inker.username}`,
            destination: `/inkers/${inker.username}.html`
        }));

        const otherRewrites = firebaseConfig.hosting.rewrites.filter(r => !r.destination.startsWith('/inkers/'));
        
        firebaseConfig.hosting.rewrites = [...inkerRewrites, ...otherRewrites];

        fs.writeFileSync(FIREBASE_CONFIG_PATH, JSON.stringify(firebaseConfig, null, 2));
        console.log(`Processed ${inkers.length} inkers`)
        console.log('firebase.json updated successfully.');

    } catch (err) {
        console.error('Error during build:', err);
        process.exit(1);
    }
}

//---

function handleEdits(template, inker) {
    template = editSEO(template, inker);
    template = editHeader(template, inker);

    return template;
}

function editSEO(template, inker) {
    const url = treatHTMLStrings(inker.username);
    const title = treatHTMLStrings(inker.name);
    const description = treatHTMLStrings(`${inker.name} - ${inker.role ?? "Contributor"}. ${inker.bio ?? ""}`);
    const image = treatHTMLStrings(inker.profilePicture ? urlFor(inker.profilePicture)
                .fit('max')
                .auto('format')
                .url() : '/src/images/placeholder-profile.png');

    template = template.replace(/{{SEOUrl}}/g, url)
    .replace(/{{SEOTitle}}/g, title)
    .replace(/{{SEODescription}}/g, description)
    .replace(/{{SEOImage}}/g, image);

    return template;
}

function editHeader(template, inker) {
    let dim = inker.profilePicture ? getImageDimensions(inker.profilePicture) : null;
    let image = treatHTMLStrings(inker.profilePicture ? urlFor(inker.profilePicture)
                .fit('max')
                .auto('format')
                .url() : '/src/images/placeholder-profile.png');

    const profilePicture = `src="${image}" alt="${inker.name}"`;
    const photoSwipe = dim ? `title="${inker.name}. Click to expand profile picture" data-pswp-src="${image}" data-pswp-width="${dim.width}" data-pswp-height="${dim.height}"` : `title="${inker.name}"`;
    const name = inker.name;
    const role = inker.role ?? "";
    const bio = inker.bio ?? "";
    
    template = template.replace(/{{HeaderProfilePicture}}/g, profilePicture)
    .replace(/{{HeaderPhotoSwipe}}/g, photoSwipe)
    .replace(/{{HeaderName}}/g, name)
    .replace(/{{HeaderRole}}/g, role)
    .replace(/{{HeaderBio}}/g, bio);
    
    return template;
}

buildInkers().then(() => {
    console.log('All tasks completed successfully.');
});