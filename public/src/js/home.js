import { createClient } from "https://esm.sh/@sanity/client";

import { hideLoadingScreen, initializeSubnav, showLoadingScreen } from "./utils/nav.js";
import { renderPreview, renderPublishedDate, renderTitle } from "./utils/list-of-articles.js";
import { urlFor } from "./utils/image-url-builder.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

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
                    title,
                    subtitle,
                    linkName,
                    publishedAt,
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
                    body
                },
            },
            
            "response": *[_type == "article"
            && !(_id in *[_type == "websiteSettings"][0].featuredArticles[]._ref)]
            | order(publishedAt desc)[0...7] {
                title,
                subtitle,
                linkName,
                publishedAt,
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
                body
            }
        },

        "newsandannouncements": 
        *[_type == "article" && type == "newsandannouncements"] | order(publishedAt desc)[0...10] {
            title,
            subtitle,
            linkName,
            publishedAt,
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
            body
        },

        "explore": 
        *[_type == "article" && type != "newsandannouncements"
            && !(_id in *[_type == "websiteSettings"][0].featuredArticles[]._ref)] 
            | order(publishedAt desc)[0...10] {
            title,
            subtitle,
            linkName,
            publishedAt,
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
            body
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

    if (article.media && article.media[0]) {
        try {        
            img.src = urlFor(article.media[0].url)
                .width(600)
                .height(400)
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

    let p = document.createElement('p');
    renderPublishedDate(article, p);

    div.appendChild(h1);
    div.appendChild(h2);
    div.appendChild(p);

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
    
    let featuredArticles = websiteSettings.featuredArticles;

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