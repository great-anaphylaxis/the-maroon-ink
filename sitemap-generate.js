const fs = require('fs');
const { createClient } = require('@sanity/client');

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const BASE_URL = 'https://the-maroon-ink.web.app';
const STATIC_PAGES = [
    { name: 'Home', url: '/' },
    { name: 'About Us', url: '/about' },
    { name: 'Privacy Policy', url: '/privacy-policy' },
    { name: 'Staff', url: '/staff' },
    { name: 'Archives', url: '/archives' },
    { name: 'Published Papers', url: '/published-papers' },
];

async function generateHtmlSitemap() {
    try {
        const data = await client.fetch(`
            *[_type in ["inker", "article"]] {
                _type,
                "title": select(
                    _type == "inker" => name,
                    _type == "article" => title
                ),
                "slug": select(
                    _type == "inker" => username.current,
                    _type == "article" => linkName.current
                )
            }[defined(slug)]`
        );

        // Separate data for clean HTML sections
        const articles = data.filter(doc => doc._type === 'article');
        const inkers = data.filter(doc => doc._type === 'inker');

        // Helper function to turn data into <li> items
        const listItems = (items, prefix = '') => 
            items.map(item => `<li><a href="${prefix}${item.url || '/' + item.slug}">${item.name || item.title}</a></li>`).join('\n            ');

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sitemap | The Maroon Ink</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; padding: 40px; max-width: 800px; margin: auto; color: #333; }
        h1 { border-bottom: 2px solid #800000; color: #800000; padding-bottom: 10px; }
        h2 { margin-top: 30px; color: #555; }
        ul { list-style: none; padding: 0; }
        li { margin-bottom: 8px; }
        a { color: #004a99; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <h1>Sitemap</h1>

    <section>
        <h2>Main Pages</h2>
        <ul>
            ${listItems(STATIC_PAGES)}
        </ul>
    </section>

    <div class="grid">
        <section>
            <h2>Articles</h2>
            <ul>
                ${listItems(articles, '/articles/')}
            </ul>
        </section>

        <section>
            <h2>Our Inkers</h2>
            <ul>
                ${listItems(inkers, '/inkers/')}
            </ul>
        </section>
    </div>

    <footer>
        <p><small>Last updated: ${new Date().toLocaleDateString()}</small></p>
    </footer>
</body>
</html>`;

        fs.writeFileSync('./public/sitemap.html', htmlContent);
        console.log('✅ sitemap.html generated successfully in /public');
    } catch (error) {
        console.error('❌ Error generating HTML sitemap:', error);
    }
}

generateHtmlSitemap();