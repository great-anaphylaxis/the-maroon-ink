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
    { url: '/', changefreq: 'daily', priority: 1.0 },
    { url: '/about', changefreq: 'monthly', priority: 0.8 },
    { url: '/privacy-policy', changefreq: 'monthly', priority: 0.3 },
    { url: '/staff', changefreq: 'monthly', priority: 0.3 },
    { url: '/archives', changefreq: 'monthly', priority: 0.8 },
];

async function generateSitemap() {
    try {
        const data = await client.fetch(`
            *[_type in ["inker", "article"]] {
                _type,
                _updatedAt,
                "slug": select(
                    _type == "inker" => username.current,
                    _type == "article" => linkName.current
                )
            }[defined(slug)]`
        );

        const links = data.map((doc) => {
            const prefix = doc._type === 'article' ? '/articles' : '/inkers';
            
            return {
                url: `${prefix}/${doc.slug}`,
                lastmod: doc._updatedAt,
                changefreq: doc._type === 'article' ? 'weekly' : 'monthly',
                priority: doc._type === 'article' ? 0.8 : 0.6,
            };
        });

        for (let i = 0; i < STATIC_PAGES.length; i++) {
            let page = STATIC_PAGES[i];

            links.unshift(page);
        }

        const stream = new SitemapStream({ hostname: BASE_URL });
        const xmlString = await streamToPromise(Readable.from(links).pipe(stream)).then((data) =>
        data.toString()
        );

        fs.writeFileSync('./public/sitemap.xml', xmlString);
        console.log('✅ sitemap.xml generated successfully in /public');
    } catch (error) {
        console.error('❌ Error generating sitemap:', error);
    }
}

generateSitemap();