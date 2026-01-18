import { createClient } from "https://esm.sh/@sanity/client?bundle";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url?bundle";
import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe.esm.js';
import { getImageDimensions } from "https://esm.sh/@sanity/asset-utils";

import { hideLoadingScreen, showLoadingScreen } from "../utils/nav.js";
import { renderPreview, renderPublishedDate, renderTitle, renderType } from "../utils/list-of-articles.js";
import { SanityImageInit, urlFor } from "../utils/image-url-builder.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

SanityImageInit(createImageUrlBuilder, client)

const contributedArticlesTitle = document.getElementById('contributedArticlesTitle');

const imgElement = document.getElementById('img');
const nameElement = document.getElementById('name');
const roleElement = document.getElementById('role');
const bioElement = document.getElementById('bio');

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
        name,
        username,
        profilePicture,
        role,
        bio
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
        let inker = e.inker[0];
        let articles = e.articles;

        if (e.inker.length == 0) {
            window.location.replace("/404.html");
        }

        renderInker(inker)
        setProperSEO(inker)

        for (let i = 0; i < articles.length; i++) {
            let article = articles[i];

            renderArticle(article)
        }

        contributedArticlesTitle.innerText = `Contribued Articles (${articles.length})`;

        hideLoadingScreen();
    });
}

function renderProfilePicture(inker) {
    let profilePicture = inker.profilePicture;
    let dim;

    if (profilePicture) {
        imgElement.src = urlFor(profilePicture)
            .fit('max')
            .auto('format')
            .url();

        dim = getImageDimensions(imgElement.src);
    }

    else {
        imgElement.src = "/src/images/placeholder-profile.png";
        dim = {
            width: 600,
            height: 600
        }
    }
    
    imgElement.alt = inker.name;

    const photoSwipeImage = document.getElementById('image-photoswipe');

    photoSwipeImage.href = imgElement.src;
    photoSwipeImage.setAttribute('data-pswp-width', "" + dim.width);
    photoSwipeImage.setAttribute('data-pswp-height', "" + dim.height);

    const lightbox = new PhotoSwipeLightbox({
        gallery: 'header a',
        pswpModule: PhotoSwipe,
        secondaryZoomLevel: 3,
    });

    lightbox.init();
}

function renderInker(inker) {
    renderProfilePicture(inker);

    nameElement.innerText = inker.name;
    roleElement.innerText = inker.role;
    bioElement.innerText = inker.bio;
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

function setProperSEO(inker) {
    const metaDescription = document.querySelector("meta[name='description']");
    const ogUrl = document.querySelector("meta[property='og:url']");
    const ogTitle = document.querySelector("meta[property='og:title']");
    const ogDescription = document.querySelector("meta[property='og:description']");
    const ogImage = document.querySelector("meta[property='og:image']");

    const url = window.location.href;
    const title = `${inker.name} | The Maroon Ink Inkers`;
    const description = `${inker.name} - ${inker.role}. ${inker.bio}`;
    const image = imgElement.src ?? '/src/images/placeholder-profile.png';

    ogUrl.setAttribute('content', url)
    document.title = title;
    ogTitle.setAttribute('content', title);
    metaDescription.setAttribute('content', description);
    ogDescription.setAttribute('content', description);
    ogImage.setAttribute('content', image);
}

getInkerAndArticles();
