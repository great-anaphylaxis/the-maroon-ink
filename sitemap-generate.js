const fs = require('fs');
const { createClient } = require('@sanity/client');
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const BASE_URL = 'https://the-maroon-ink.web.app';
const STATIC_PAGES = [
    { name: 'Home', url: '/', changefreq: 'daily', priority: 1.0 },
    { name: 'About Us', url: '/about', changefreq: 'monthly', priority: 0.8 },
    { name: 'Privacy Policy', url: '/privacy-policy', changefreq: 'monthly', priority: 0.3 },
    { name: 'Staff', url: '/staff', changefreq: 'monthly', priority: 0.3 },
    { name: 'Archives', url: '/archives', changefreq: 'monthly', priority: 0.8 },
    { name: 'Published Papers', url: '/published-papers', changefreq: 'monthly', priority: 0.8 },
];

async function generateSitemaps() {
    try {
        // 1. Fetch data for Articles, Inkers, and Published Papers
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

        // --- PART A: XML GENERATION ---
        const xmlLinks = data.map((doc) => {
            let prefix = '/articles';
            if (doc._type === 'inker') prefix = '/inkers';
            if (doc._type === 'publishedPaper') prefix = '/published-papers';

            return {
                url: `${prefix}/${doc.slug}`,
                lastmod: doc._updatedAt,
                changefreq: doc._type === 'inker' ? 'monthly' : 'weekly',
                priority: doc._type === 'inker' ? 0.6 : 0.8,
            };
        });

        // Add static pages to XML
        STATIC_PAGES.forEach(page => xmlLinks.unshift({ url: page.url, changefreq: page.changefreq, priority: page.priority }));

        const stream = new SitemapStream({ hostname: BASE_URL });
        const xmlString = await streamToPromise(Readable.from(xmlLinks).pipe(stream)).then(data => data.toString());
        fs.writeFileSync('./public/sitemap.xml', xmlString);
        console.log('✅ sitemap.xml generated');

        // --- PART B: HTML GENERATION ---
        const articles = data.filter(doc => doc._type === 'article');
        const inkers = data.filter(doc => doc._type === 'inker');
        const papers = data.filter(doc => doc._type === 'publishedPaper');

        const listItems = (items, prefix = '') => 
            items.map(item => `<li><a href="${prefix}${item.url || '/' + item.slug}">${item.name || item.title || item.url}</a></li>`).join('\n            ');

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
        h2 { margin-top: 30px; color: #800000; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 1px; }
        ul { list-style: none; padding: 0; }
        li { margin-bottom: 8px; }
        a { color: #004a99; text-decoration: none; transition: color 0.2s; }
        a:hover { color: #800000; text-decoration: underline; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 40px; margin-top: 20px; }
        footer { margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 0.8rem; color: #777; }
    </style>
</head>
<body>
    <h1>The Maroon Ink Sitemap</h1>

    <section>
        <h2>Navigation</h2>
        <ul style="display: flex; gap: 20px; flex-wrap: wrap;">
            ${listItems(STATIC_PAGES)}
        </ul>
    </section>

    <div class="grid">
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
    </div>

    <footer>
        <p>Generated on ${new Date().toLocaleDateString()} | &copy; The Maroon Ink</p>
    </footer>
</body>
</html>`;

        fs.writeFileSync('./public/sitemap.html', htmlContent);
        console.log('✅ sitemap.html generated');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

generateSitemaps();