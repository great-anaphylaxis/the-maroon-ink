import { createClient } from "https://esm.sh/@sanity/client";
import { toHTML, uriLooksSafe } from "https://esm.sh/@portabletext/to-html";
import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe.esm.js';
import PhotoSwipeVideoPlugin from 'https://cdn.jsdelivr.net/npm/photoswipe-video-plugin@1.0.2/+esm'
import { getImageDimensions } from "https://esm.sh/@sanity/asset-utils";

import { hideLoadingScreen, showLoadingScreen } from "../utils/nav.js";
import { renderPublishedDate, getArticlePreview } from "../utils/list-of-articles.js";
import { urlFor } from "../utils/image-url-builder.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

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

const titleElement = document.getElementById('title');
const subtitleElement = document.getElementById('subtitle');
const inkersElement = document.getElementById('inkers');
const dateElement = document.getElementById('date');
const mediaElement = document.getElementById('media');
const mainElement = document.getElementById('main');
const inkersOnDutyElement = document.getElementById('inkers-on-duty');
const footerElement = document.getElementById('footer');
const footerHr = document.getElementById('footerHr');
const articleInfoDivider = document.getElementById('article-info-divider');

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
};

function getArticleLinkName() {
    let path =  window.location.pathname;
    let str = path.split('/');

    return str[2];
}

function getArticle() {
    showLoadingScreen(); 

    const linkName = getArticleLinkName();
    const article = client.fetch(`*[_type == "article" && linkName.current == $linkName]{
        title,
        subtitle,
        linkName,
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
    }`, {linkName: linkName});

    article.then(e => {
        for (let i = 0; i < e.length; i++) {
            let article = e[i];
            
            renderArticle(article)
            setProperSEO(article)
        }

        if (e.length == 0) {
            window.location.replace("/404.html");
        }

        hideLoadingScreen();
    });
}

function renderContributors(article) {
    let inkersOnDuty = [];
    let str = "";

    if (!article.inkersOnDuty || article.inkersOnDuty.length == 0) {
        footerElement.style.display = 'none';
        footerHr.style.display = 'none';
        articleInfoDivider.style.display = 'none';


        return;
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

    inkersElement.innerText = str;
}

function renderInkersOnDuty(article) {
    if (!article.inkersOnDuty) {
        return;
    }

    for (let i = 0; i < article.inkersOnDuty.length; i++) {
        let inkers = article.inkersOnDuty[i];

        let name = inkers.name;
        let username = inkers.username.current;
        let role = inkers.role;
        let profilePicture = inkers.profilePicture;

        let a = document.createElement('a');
        a.href = "/inkers/" + username;
        a.target = "_self";

        let art = document.createElement('article');
        art.classList.add('inkers');

        let img = document.createElement('img');
        
        img.alt = name;

        if (profilePicture) {
            img.src = urlFor(profilePicture)
                .width(100)
                .height(100)
                .fit('max')
                .auto('format')
                .url();
        }

        else {
            img.src = "/src/images/placeholder-profile.png";
        } 

        let divParent = document.createElement('div');

        let h3 = document.createElement('h3');
        h3.innerText = name;

        let p = document.createElement('p');
        p.innerText = role;

        divParent.appendChild(h3);
        divParent.appendChild(p);

        art.appendChild(img);
        art.appendChild(divParent);

        a.appendChild(art);

        inkersOnDutyElement.appendChild(a);
    }
}

function renderMedia(article) {
    if (!article.media || !article.media[0]) {
        mediaElement.style.display = 'none';

        return;
    }

    for (let i = 0; i < article.media.length; i++) {
        const MAX_VISIBLE_IMAGES = 5;

        const media = article.media[i].thumbnailUrl ?? article.media[i].url;
        const type = article.media[i]._type;
        const img = document.createElement('img');

        img.classList.add('image')

        try {        
            img.src = urlFor(media)
                .fit('max')
                .auto('format')
                .url();
        }
        catch {
            img.src = '/src/images/banner.jpg'

            console.error(article.media)
        }
        
        const a = document.createElement('a');
        a.title = "Click image to expand";

        a.appendChild(img);
        mediaElement.appendChild(a);

        img.loading = "lazy";
        img.alt = article.title;

        const dim = getImageDimensions(media);

        a.href = img.src;
        a.setAttribute('data-pswp-width', "" + dim.width);
        a.setAttribute('data-pswp-height', "" + dim.height);

        if (type == 'file') {
            const vid = article.media[i].url;

            a.href = vid;
            a.setAttribute('data-pswp-video-src', "" + vid);
            a.setAttribute('data-pswp-type', "video");
        }

        if (i >= MAX_VISIBLE_IMAGES) {
            const children = mediaElement.querySelectorAll('a');
            const subtrahend = MAX_VISIBLE_IMAGES - 1;

            const extraCount = children.length - subtrahend;
            const fifthChild = children[subtrahend];

            fifthChild.setAttribute('data-count', extraCount);
        }
    }

    const lightbox = new PhotoSwipeLightbox({
        gallery: '#media',
        children: 'a',
        pswpModule: PhotoSwipe
    });

    const videoPlugin = new PhotoSwipeVideoPlugin(lightbox, {
        // options
    });

    
    lightbox.init();
}

function setFacebookArticleLink(article) {
    const btn = document.getElementById('fb-footer-button');
    const url = article.fbLink;

    if (!url) {
        btn.style.display = 'none';
    }

    else if (url) {
        btn.href = url
    }
    
}

function renderArticle(article) {
    let title = article.title;
    let subtitle = article.subtitle;
    let content = toHTML(article.body, {components: components});

    titleElement.innerText = title;
    subtitleElement.innerText = subtitle;
    mainElement.innerHTML = content;

    renderPublishedDate(article, dateElement)
    renderContributors(article);
    renderMedia(article);

    renderInkersOnDuty(article);
    setFacebookArticleLink(article);

    return;
}

function setProperSEO(article) {
    const firstImage = mediaElement.querySelectorAll('a > img')?.[0]?.src;

    const metaDescription = document.querySelector("meta[name='description']");
    const ogUrl = document.querySelector("meta[property='og:url']");
    const ogTitle = document.querySelector("meta[property='og:title']");
    const ogDescription = document.querySelector("meta[property='og:description']");
    const ogImage = document.querySelector("meta[property='og:image']");

    const url = window.location.href;
    const title = `${article.title} | The Maroon Ink Articles`;
    const description = getArticlePreview(article)
    const image = firstImage ?? '/src/images/banner.jpg';

    ogUrl.setAttribute('content', url)
    document.title = title;
    ogTitle.setAttribute('content', title);
    metaDescription.setAttribute('content', description);
    ogDescription.setAttribute('content', description);
    ogImage.setAttribute('content', image);
}

function onhashchange() {
    let options = {
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
    };

    let hash = window.location.hash.slice(1);

    history.replaceState("", document.title, window.location.pathname + window.location.search);

    const e = document.querySelector(hash)
    
    if (e) {
        e.scrollIntoView(options);
    }
}

getArticle();

window.onhashchange = onhashchange;
