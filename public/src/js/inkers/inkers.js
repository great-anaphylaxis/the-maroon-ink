import { createClient } from "https://esm.sh/@sanity/client?bundle";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url?bundle";
import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe.esm.js';

import { hideLoadingScreen, showLoadingScreen } from "../utils/nav.js";
import { renderPreview, renderPublishedDate, renderTitle, renderType } from "../utils/list-of-articles.js";
import { SanityImageInit, urlFor } from "../utils/image-url-builder.js";
import { log } from "../utils/log-events.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

SanityImageInit(createImageUrlBuilder, client)

const contributedArticlesTitle = document.getElementById('contributedArticlesTitle');

const mainElement = document.getElementById('main');

function getInkerUsername() {
    let path =  window.location.pathname;
    let str = path.split('/');

    return str[2];
}

function getInkerAndArticles() {
    const username = getInkerUsername();
    
    const inkerAndArticles = client.fetch(`{
    "inker": *[_type == "inker" && username.current == $username]{
        profilePicture
    },
    
    "articles": *[_type == "article" && inkersOnDuty[]->username.current match $username]
    | order(publishedAt desc) {
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
    }}`, {username: username});

    inkerAndArticles.then(e => {
        let inker = e.inker[0]
        let articles = e.articles;

        if (e.inker.length == 0) {
            window.location.replace("/404.html");
        }

        renderProfilePicture(inker);

        for (let i = 0; i < articles.length; i++) {
            let article = articles[i];

            renderArticle(article)
        }

        contributedArticlesTitle.innerText = `Contribued Articles (${articles.length})`;

        log(`"${document.title}" inker page loaded`)

        hideLoadingScreen();
    });
}

function renderProfilePicture(inker) {
    if (!inker.profilePicture) {
        return;
    }

    const lightbox = new PhotoSwipeLightbox({
        gallery: 'header a',
        pswpModule: PhotoSwipe,
        secondaryZoomLevel: 3,
    });

    lightbox.init();
}

function renderArticle(article) {
    let a = document.createElement('a');
    a.href = '/articles/' + article.linkName.current;

    let art = document.createElement('article');
    art.classList.add('articles');

    let div = document.createElement('div');

    
    let img = document.createElement('img');
    img.loading = "lazy";
    
    if (article.media && article.media[0]) {
        const media = article.media[0].thumbnailUrl ?? article.media[0].url;
        
        try {        
            img.src = urlFor(media)
                .width(186)
                .height(100)
                .fit('max')
                .auto('format')
                .url();
        }
        catch {
            img.src = '/src/images/banner.jpg'

            console.error(article.media)
        }
    }

    img.alt = article.title;

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

    mainElement.appendChild(a);

    return;
}

getInkerAndArticles();
