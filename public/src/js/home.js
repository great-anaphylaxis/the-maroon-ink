import { createClient } from "https://esm.sh/@sanity/client?bundle";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url?bundle";

import { hideLoadingScreen, initializeSubnav, showLoadingScreen } from "./utils/nav.js";
import { renderPreview, renderPublishedDate, renderTitle, renderType } from "./utils/list-of-articles.js";
import { SanityImageInit, urlFor } from "./utils/image-url-builder.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

SanityImageInit(createImageUrlBuilder, client)

const featuredArticlesElement = document.getElementById('featuredArticles');
const featuredArticlesTitle = document.getElementById('featuredArticlesTitle');
const articleListElement = document.getElementById('articleList');
const articleListTitle = document.getElementById('articleListTitle');

let savedQueryData;

function getArticle(name) {
    let query = `
    {
        "foryou": {
            "websiteSettings": *[_type == "websiteSettings"][0] {
                "featuredArticles": featuredArticles[]->{
                    _id,
                    type,
                    title,
                    subtitle,
                    linkName,
                    publishedAt,
                    media[0...1] {
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
                    body[0...1]
                },
            },
            
            "response": *[_type == "article"
            && !(_id in *[_type == "websiteSettings"][0].featuredArticles[]._ref)]
            | order(publishedAt desc)[0...7] {
                type,
                title,
                subtitle,
                linkName,
                publishedAt,
                media[0...1] {
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
                body[0...1]
            }
        },

        "newsandannouncements": 
        *[_type == "article" && type == "newsandannouncements"] | order(publishedAt desc)[0...10] {
            type,
            title,
            subtitle,
            linkName,
            publishedAt,
            media[0...1] {
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
            body[0...1]
        },

        "explore": 
        *[_type == "article" && type != "newsandannouncements"
            && !(_id in *[_type == "websiteSettings"][0].featuredArticles[]._ref)] 
            | order(publishedAt desc)[0...10] {
            type,
            title,
            subtitle,
            linkName,
            publishedAt,
            media[0...1] {
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
            body[0...1]
        }
    }`;

    if (!savedQueryData) {
        showLoadingScreen();

        const article = client.fetch(query);

        article.then(s => {
            let e = s[name];

            let res = e.response ?? e;
            let websiteSettings = e.websiteSettings;

            applyWebsiteSettings(websiteSettings);

            for (let i = 0; i < res.length; i++) {
                let article = res[i];
                
                renderArticle(article, articleListElement)
            }

            hideLoadingScreen();

            savedQueryData = s;
        });

    }

    else if (savedQueryData) {
        let e = savedQueryData[name];

        let res = e.response ?? e;
        let websiteSettings = e.websiteSettings;

        applyWebsiteSettings(websiteSettings);

        for (let i = 0; i < res.length; i++) {
            let article = res[i];
            
            renderArticle(article, articleListElement)
        }

        hideLoadingScreen();
    }
    
}

function renderArticle(article, parent) {
    let a = document.createElement('a');
    a.href = '/articles/' + article.linkName.current;

    let art = document.createElement('article');
    art.classList.add('articles');

    let div = document.createElement('div');

    let img = document.createElement('img');
    img.alt = article.title;
    img.loading = "lazy";

    if (article.media && article.media[0]) {
        const media = article.media[0].thumbnailUrl ?? article.media[0].url;
        
        try {        
            img.src = urlFor(media)
                .width(300)
                .height(200)
                .fit('max')
                .auto('format')
                .url();
        }
        catch {
            img.src = '/src/images/banner.jpg'

            // to do: videos
            console.error( article.media)
        }
    }

    else {
        img.src = '/src/images/banner.jpg';
    }

    let h1 = document.createElement('h1');
    renderTitle(article, h1);

    let h2 = document.createElement('h2');
    renderPreview(article, h2);

    let div2 = document.createElement('div');

    let span = document.createElement('span');
    renderType(article, span)

    let p = document.createElement('p');
    renderPublishedDate(article, p);
    
    div2.appendChild(span)
    div2.appendChild(p)

    div.appendChild(h1);
    div.appendChild(h2);
    div.appendChild(div2);

    art.appendChild(div);
    art.appendChild(img);

    a.appendChild(art);

    parent.appendChild(a);

    return;
}

function applyWebsiteSettings(websiteSettings) {
    if (!websiteSettings) {
        return;
    }
    
    let featuredArticles = websiteSettings.featuredArticles ?? [];

    for (let i = 0; i < featuredArticles.length; i++) {
        let article = featuredArticles[i];
        
        renderArticle(article, featuredArticlesElement)
    }
}

function changeArticleFeed(name) {
    featuredArticlesElement.textContent = '';
    articleListElement.textContent = '';

    if (name == 'foryou') {
        featuredArticlesTitle.style.display = "block";
        articleListTitle.innerText = 'Recent Articles';
    }

    else {
        if (name == 'newsandannouncements') {
            articleListTitle.innerText = 'News & Announcements';
        }

        if (name == 'explore') {
            articleListTitle.innerText = 'Explore Other Articles';
        }

        featuredArticlesTitle.style.display = 'none';
    }

    getArticle(name);
}

initializeSubnav(changeArticleFeed);
