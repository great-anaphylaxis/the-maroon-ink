import { createClient } from "https://esm.sh/@sanity/client";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const builder = createImageUrlBuilder(client);

const featuredArticlesElement = document.getElementById('featuredArticles');
const recentArticlesElement = document.getElementById('recentArticles');

function urlFor(source) {
    return builder.image(source);
}

function getArticle() {
    const article = client.fetch(`{
        "websiteSettings": *[_type == "websiteSettings"][0] {
            "featuredArticles": featuredArticles[]->{
                _id,
                title,
                subtitle,
                linkName,
                publishedAt,
                image,
                body
            },
        },
        
        "response": *[_type == "article"
        && !(_id in *[_type == "websiteSettings"][0].featuredArticles[]._ref)] 
        | order(publishedAt desc) {
            title,
            subtitle,
            linkName,
            publishedAt,
            image,
            body
        }
    }`);

    article.then(e => {
        let res = e.response;
        let websiteSettings = e.websiteSettings;

        applyWebsiteSettings(websiteSettings);

        for (let i = 0; i < res.length; i++) {
            let article = res[i];
            
            renderArticle(article, recentArticlesElement)
        }
    });
}

function renderPublishedDate(article, dateElement) {
    const date = new Date(article.publishedAt);
    const now = new Date();
    
    const diffInMs = now - date;
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    const isSameDay = date.toDateString() === now.toDateString();
    
    if (isSameDay) {
        if (diffInMins < 1) {
            dateElement.innerText = "Just now";
            return;
        }
        if (diffInHours < 1) {
            dateElement.innerText = `${diffInMins} minute${diffInMins === 1 ? '' : 's'} ago`;
            return;
        }

        dateElement.innerText = `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
        return;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const isSameYear = date.getFullYear() === now.getFullYear();

    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const yearPart = date.toLocaleDateString('en-US', { year: 'numeric' });
    const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '');

    if (isYesterday) {
        dateElement.innerText = `Yesterday`;
    } else if (isSameYear) {
        dateElement.innerText = `${monthDay}`;
    } else {
        dateElement.innerText = `${monthDay}, ${yearPart}`;
    }
}

function renderPreview(article, previewElement) {
    if (article.subtitle) {
        previewElement.innerText = article.subtitle;
    }

    else if (
        article.body[0] &&
        article.body[0].children[0] &&
        article.body[0].children[0].text
    ) {
        let str = article.body[0].children[0].text;
        let maxCharLength = 100;

        let firstSentence = str.split(/(?<=[.!?])\s/)[0];

        let finalTarget = firstSentence.length > maxCharLength 
            ? firstSentence.substring(0, maxCharLength) + "..." 
            : firstSentence;

        previewElement.innerText = finalTarget.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
    }

    return;
}

function renderTitle(article, titleElement) {
    if (article.title) {
        let title = article.title;
        let maxCharLength = 60;

        let str = title.length > maxCharLength 
            ? title.substring(0, maxCharLength) + "..." 
            : title;

        titleElement.innerText = str;
    }
}

function renderArticle(article, parent) {
    let a = document.createElement('a');
    a.href = '/articles/' + article.linkName.current;

    let art = document.createElement('article');
    art.classList.add('articles');

    let div = document.createElement('div');

    let img = document.createElement('img');
    img.src = urlFor(article.image)
        .width(600)
        .height(400)
        .fit('max')
        .auto('format')
        .url();
    img.alt = article.title;

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
    let featuredArticles = websiteSettings.featuredArticles;

    for (let i = 0; i < featuredArticles.length; i++) {
        let article = featuredArticles[i];
        
        renderArticle(article, featuredArticlesElement)
    }
}

getArticle();