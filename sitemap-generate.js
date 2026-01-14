const fs = require('fs');
const { createClient } = require('@sanity/client');
const { SitemapStream, streamToPromise, SitemapIndexStream } = require('sitemap');
const { Readable } = require('stream');

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const BASE_URL = 'https://the-maroon-ink.web.app';
const PUBLIC_DIR = './public';

const STATIC_PAGES = [
    { url: '/', changefreq: 'daily', priority: 1.0, title: 'Home' },
    { url: '/about', changefreq: 'monthly', priority: 0.8, title: 'About Us' },
    { url: '/privacy-policy', changefreq: 'monthly', priority: 0.3, title: 'Privacy Policy' },
    { url: '/staff', changefreq: 'monthly', priority: 0.3, title: 'Staff' },
    { url: '/archives', changefreq: 'monthly', priority: 0.8, title: 'Archives' },
    { url: '/published-papers', changefreq: 'monthly', priority: 0.8, title: 'Published Papers' },
];

/**
 * Helper to write a sitemap file from an array of links
 */
async function writeSitemap(filename, links) {
    const stream = new SitemapStream({ hostname: BASE_URL });
    const xmlString = await streamToPromise(Readable.from(links).pipe(stream)).then(data => data.toString());
    fs.writeFileSync(`${PUBLIC_DIR}/${filename}`, xmlString);
    console.log(`✅ ${filename} generated`);
    return `${BASE_URL}/${filename}`;
}

async function generateSitemaps() {
    try {
        if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);

        // 1. Fetch data from Sanity
        const data = await client.fetch(`
            *[_type in ["inker", "article", "publishedPaper"]] {
                _type,
                _updatedAt,
                "title": select(
                    _type == "inker" => name,
                    _type == "article" => title,
                    _type == "publishedPaper" => title
                ),
                "slug": select(
                    _type == "inker" => username.current,
                    _type == "article" => linkName.current,
                    _type == "publishedPaper" => linkName.current
                )
            }[defined(slug)]`
        );

        const articles = data.filter(doc => doc._type === 'article');
        const inkers = data.filter(doc => doc._type === 'inker');
        const papers = data.filter(doc => doc._type === 'publishedPaper');

        // --- PART A: GENERATE INDIVIDUAL XML SITEMAPS ---

        const sitemapFiles = [];

        // Static Pages Sitemap
        sitemapFiles.push(await writeSitemap('sitemap-static.xml', STATIC_PAGES));

        // Articles Sitemap
        const articleLinks = articles.map(doc => ({
            url: `/articles/${doc.slug}`,
            lastmod: doc._updatedAt,
            changefreq: 'weekly',
            priority: 0.8
        }));
        sitemapFiles.push(await writeSitemap('sitemap-articles.xml', articleLinks));

        // Inkers Sitemap
        const inkerLinks = inkers.map(doc => ({
            url: `/inkers/${doc.slug}`,
            lastmod: doc._updatedAt,
            changefreq: 'monthly',
            priority: 0.6
        }));
        sitemapFiles.push(await writeSitemap('sitemap-inkers.xml', inkerLinks));

        // Papers Sitemap
        const paperLinks = papers.map(doc => ({
            url: `/published-papers/${doc.slug}`,
            lastmod: doc._updatedAt,
            changefreq: 'weekly',
            priority: 0.8
        }));
        sitemapFiles.push(await writeSitemap('sitemap-papers.xml', paperLinks));

        // --- PART B: GENERATE SITEMAP INDEX ---

        const indexStream = new SitemapIndexStream();
        const indexXmlPromise = streamToPromise(Readable.from(sitemapFiles).pipe(indexStream)).then(data => data.toString());
        fs.writeFileSync(`${PUBLIC_DIR}/sitemap-index.xml`, await indexXmlPromise);
        console.log('✅ sitemap-index.xml generated');

        // --- PART C: HTML GENERATION (For Humans) ---

        const listItems = (items, prefix = '', isStatic = false) => 
            items.map(item => {
                const url = isStatic ? item.url : `${prefix}${item.slug}`;
                const label = item.title || item.name || item.url;
                return `<li><a href="${url}">${label}</a></li>`;
            }).join('\n            ');

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/x-icon" href="/src/icons/favicon.ico">
    <title>Sitemap | The Maroon Ink</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; padding: 40px; max-width: 1000px; margin: auto; color: #333; }
        h1 { border-bottom: 3px solid #800000; color: #800000; padding-bottom: 10px; }
        h2 { margin-top: 30px; color: #800000; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 1px; border-left: 4px solid #800000; padding-left: 10px; }
        ul { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
        li { margin-bottom: 4px; }
        a { color: #004a99; text-decoration: none; transition: color 0.2s; }
        a:hover { color: #800000; text-decoration: underline; }
        footer { margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 0.8rem; color: #777; }
    </style>
</head>
<body>
    <h1>The Maroon Ink Sitemap</h1>

    <section>
        <h2>Navigation</h2>
        <ul>${listItems(STATIC_PAGES, '', true)}</ul>
    </section>

    <section>
        <h2>Articles</h2>
        <ul>${listItems(articles, '/articles/')}</ul>
    </section>

    <section>
        <h2>Published Papers</h2>
        <ul>${listItems(papers, '/published-papers/')}</ul>
    </section>

    <section>
        <h2>Our Inkers</h2>
        <ul>${listItems(inkers, '/inkers/')}</ul>
    </section>

    <footer>
        <p>Generated on ${new Date().toLocaleDateString()} | &copy; The Maroon Ink</p>
        <p>XML Sitemaps: <a href="/sitemap-index.xml">Index</a></p>
    </footer>
</body>
</html>`;

        fs.writeFileSync(`${PUBLIC_DIR}/sitemap.html`, htmlContent);
        console.log('✅ sitemap.html generated');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

generateSitemaps();