const fs = require('fs');
const path = require('path');
const { createClient } = require('@sanity/client');
const { getImageDimensions } = require('@sanity/asset-utils')
const { toHTML } = require('@portabletext/to-html')
const { createImageUrlBuilder } = require('@sanity/image-url');

// --- Configuration ---
const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const ARTIFACT_DIR = './public/articles';
const TEMPLATE_PATH = './build/template-articles.html';
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

async function buildArticles() {
    try {
        // --- Phase 1: Retrieve and Generate HTML ---
        console.log('Fetching articles from Sanity...');
        const articles = await client.fetch(`
            *[_type == "article"] {
                title,
                subtitle,
                "linkName": linkName.current,
                publishedAt,
                "inkersOnDuty": inkersOnDuty[]->{
                    name,
                    username,
                    role,
                    profilePicture
                },
                media[] {
                    _type,
                    _key,
                    _type == 'image' => {
                        "url": asset->url,
                    },
                    _type == 'file' => {
                        "url": asset->url,
                        "thumbnailUrl": thumbnail.asset->url
                    }
                },
                body,
                fbLink
            }
        `);
        
        if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

        const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

        articles.forEach(article => {
            const htmlContent = handleEdits(template, article);

            const filePath = path.join(ARTIFACT_DIR, `${article.linkName}.html`);
            fs.writeFileSync(filePath, htmlContent);
            console.log(`Generated: ${article.linkName}.html`);
        });

        console.log('Updating Firebase rewrites...');
        const firebaseConfig = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8'));

        const articleRewrites = articles.map(article => ({
            source: `/articles/${article.linkName}`,
            destination: `/articles/${article.linkName}.html`
        }));

        const otherRewrites = firebaseConfig.hosting.rewrites.filter(r => !r.destination.startsWith('/articles/'));
        
        firebaseConfig.hosting.rewrites = [...articleRewrites, ...otherRewrites];

        fs.writeFileSync(FIREBASE_CONFIG_PATH, JSON.stringify(firebaseConfig, null, 2));
        console.log(`Processed ${articles.length} articles`)
        console.log('firebase.json updated successfully.');

    } catch (err) {
        console.error('Error during build:', err);
        process.exit(1);
    }
}

//---

function handleEdits(template, article) {
    template = editSEO(template, article);
    template = editHeader(template, article);
    template = editMedia(template, article);
    template = editMainContent(template, article);
    template = editFooter(template, article);

    return template;
}

function editSEO(template, article) {
    const url = `https://themaroon.ink/articles/${treatHTMLStrings(article.linkName)}`;
    const title = treatHTMLStrings(article.title);
    const description = treatHTMLStrings(getArticlePreview(article));
    const image = treatHTMLStrings(article.media[0]?.thumbnailUrl ?? article.media[0]?.url ?? '/src/images/banner.jpg');

    template = template.replace(/{{SEOUrl}}/g, url)
    .replace(/{{SEOTitle}}/g, title)
    .replace(/{{SEODescription}}/g, description)
    .replace(/{{SEOImage}}/g, image);

    return template;
}

function editHeader(template, article) {
    const title = article.title;
    const subtitle = article.subtitle ?? "";
    const date = getPublishedDate(article);
    let isVisible = "";

    let inkersOnDuty = [];
    let str = "";

    if (!article.inkersOnDuty || article.inkersOnDuty.length == 0) {
        isVisible = `style="display: none;"`;
    }

    for (let i = 0; i < article.inkersOnDuty.length; i++) {
        let inkers = article.inkersOnDuty[i];

        let name = inkers.name;

        inkersOnDuty.push(name)
    }

    let count = inkersOnDuty.length;

    if (count === 1) {
        str = `By: ${inkersOnDuty[0]}`;
    } else if (count === 2) {
        str = `By: ${inkersOnDuty[0]} & ${inkersOnDuty[1]}`;
    } else if (count === 3) {
        str = `By: ${inkersOnDuty[0]}, ${inkersOnDuty[1]}, & 1 other`;
    } else if (count > 3) {
        const remaining = count - 2;
        str = `By: ${inkersOnDuty[0]}, ${inkersOnDuty[1]}, & ${remaining} others`;
    }

    inkers = str;

    template = template.replace(/{{HeaderTitle}}/g, title)
    .replace(/{{HeaderSubtitle}}/g, subtitle)
    .replace(/{{HeaderInkers}}/g, str)
    .replace(/{{HeaderDate}}/g, date)
    .replace(/{{HeaderIsVisible}}/g, isVisible);
    
    return template;
}

function editMedia(template, article) {
    let mediaContent = "";
    let isVisible = "";

    if (!article.media || !article.media[0]) {
        isVisible = `style="display: none;"`;
    }

    for (let i = 0; i < article.media.length; i++) {
        const MAX_VISIBLE_IMAGES = 5;
        
        const title = treatHTMLStrings(article.title);

        let media = article.media[i].thumbnailUrl ?? article.media[i].url;
        const type = article.media[i]._type;

        try {        
            media = urlFor(media)
                .fit('max')
                .auto('format')
                .url();
        }
        catch {
            media = '/src/images/banner.jpg'
        }

        const dim = getImageDimensions(media);

        let img = `<img class="image" src="${media}" loading="lazy" alt="${title}">`
        let a = 
        `<a title="Click to expand" data-pswp-src="${media}" data-pswp-width="${dim.width}" data-pswp-height="${dim.height}" {{VideoAttributes}} {{DataCount}}>`;

        if (type == 'file') {
            const vid = article.media[i].url;

            a = a.replace(/{{VideoAttributes}}/g, `data-pswp-video-src="${vid}" data-pswp-type="video"`)
        }

        else {
            a = a.replace(/{{VideoAttributes}}/g, "");
        }

        if (i == MAX_VISIBLE_IMAGES - 1) {
            const subtrahend = MAX_VISIBLE_IMAGES - 1;
            const extraCount = article.media.length - subtrahend;

            a = a.replace(/{{DataCount}}/g, `data-count="${extraCount}"`);
        }

        else {
            a = a.replace(/{{DataCount}}/g, "");
        }

        const output = `${a}${img}</a>`

        mediaContent += output;
    }

    template = template.replace(/{{MediaContent}}/g, mediaContent)
    .replace(/{{MediaIsVisible}}/g, isVisible);
    
    return template;
}

function editMainContent(template, article) {
    const html = toHTML(article.body, {components: components});

    template = template.replace(/{{MainContent}}/g, html);

    return template;
}

function editFooter(template, article) {
    let inkersOnDuty = "";
    const url = article.fbLink;

    if (!url) {
        template = template.replace(/{{FooterFbButtonIsVisible}}/g, `style="display: none;"`)
        .replace(/{{FooterFbButtonHref}}/g, "/404.html");
    }

    else if (url) {
        template = template.replace(/{{FooterFbButtonIsVisible}}/g, "")
        .replace(/{{FooterFbButtonHref}}/g, article.fbLink);
    }

    if (!article.inkersOnDuty) {
        template = template.replace(/{{FooterInkersOnDuty}}/g, "");
    }

    //---

    for (let i = 0; i < article.inkersOnDuty.length; i++) {
        let inkers = article.inkersOnDuty[i];

        let name = treatHTMLStrings(inkers.name);
        let username = inkers.username.current;
        let role = inkers.role ?? "";
        let profilePicture = inkers.profilePicture;

        if (profilePicture) {
            profilePicture = urlFor(profilePicture)
                .width(100)
                .height(100)
                .fit('max')
                .auto('format')
                .url();
        }

        else {
            profilePicture = randomProfilePicture(inkers.name);
        } 

        const inker = `
                <a href="/inkers/${username}" target="_self">
                    <article class="inkers">
                        <img alt="${name}" src="${profilePicture}">
                        <div>
                            <h3>${name}</h3>
                            <p>${role}</p>
                        </div>
                    </article>
                </a>`;

        inkersOnDuty += inker;
    }

    template = template.replace(/{{FooterInkersOnDuty}}/g, inkersOnDuty);

    return template
} 


//---------------

function getArticlePreview(article) {
    if (article.subtitle) {
        return article.subtitle;
    }

    else if (
        article.body?.[0]?.children?.[0]?.text
    ) {
        let str = article.body[0].children[0].text;
        let maxCharLength = 100;

        // Split by sentence but keep the first one
        let firstSentence = str.split(/(?<=[.!?])\s/)[0];

        let finalTarget = firstSentence.length > maxCharLength 
            ? firstSentence.substring(0, maxCharLength) + "..." 
            : firstSentence;

        return finalTarget
            .normalize("NFKD")
            // This updated regex removes non-printable control characters 
            // but keeps standard text, numbers, and common punctuation (including dashes)
            .replace(/[^\x20-\x7E\u2013\u2014]/g, "");
    }

    return "";
}

function getPublishedDate(article) {
    const date = new Date(article.publishedAt);
    const publishedDate = date.toString('en-US');

    return publishedDate;
}

function randomProfilePicture(name) {
    return `https://api.dicebear.com/9.x/initials/svg?seed=${name}`;
}

buildArticles().then(() => {
    console.log('All tasks completed successfully.');
});