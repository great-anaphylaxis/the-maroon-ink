import { createClient } from "https://esm.sh/@sanity/client";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url";
import { toHTML, uriLooksSafe } from "https://esm.sh/@portabletext/to-html";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const builder = createImageUrlBuilder(client);

const components = {
    marks: {
        link: ({children, value}) => {
            const href = value.href || '';

            if (uriLooksSafe(href)) {
                return `<a href="${getValidUrl(href)}" target="_blank">${children}</a>`;
            }

            return children
        }
    }
}

const titleElement = document.getElementById('title');
const inkersElement = document.getElementById('inkers');
const dateElement = document.getElementById('date');
const imageElement = document.getElementById('image');
const mainElement = document.getElementById('main');

function urlFor(source) {
    return builder.image(source);
}

function getArticleLinkName() {
    let path =  window.location.pathname;
    let str = path.split('/');

    return str[2];
}

function getArticle() {
    const linkName = getArticleLinkName();
    const article = client.fetch(`*[_type == "article" && linkName.current == "${linkName}"]{
        title,
        linkName,
        publishedAt,
        "inkersOnDuty": inkersOnDuty[]->{
            name,
            username,
            profilePicture
        },
        image,
        body
    }`);

    article.then(e => {
        for (let i = 0; i < e.length; i++) {
            let article = e[i];
            
            renderArticle(article)
        }
    });
}

function renderInkersOnDuty(article) {
    let inkersOnDuty = [];
    let str = "";

    for (let i = 0; i < article.inkersOnDuty.length; i++) {
        let inkers = article.inkersOnDuty[i];

        let name = inkers.name;

        inkersOnDuty.push(name)
    }

    let count = inkersOnDuty.length;

    if (count === 1) {
        str = `By: ${inkersOnDuty[0]}`;
    } else if (count === 2) {
        str = `By: ${inkersOnDuty[0]} and ${inkersOnDuty[1]}`;
    } else if (count > 2) {
        const remaining = count - 2;
        str = `By: ${inkersOnDuty[0]}, ${inkersOnDuty[1]}, and ${remaining} more`;
    }

    inkersElement.innerText = str;
}

function renderPublishedDate(article) {
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

    const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const yearPart = date.toLocaleDateString('en-US', { year: 'numeric' });
    const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '');

    if (isYesterday) {
        dateElement.innerText = `Yesterday at ${timePart}`;
    } else if (isSameYear) {
        dateElement.innerText = `${monthDay} at ${timePart}`;
    } else {
        dateElement.innerText = `${monthDay}, ${yearPart}`;
    }
}

function renderImage(article) {
    imageElement.src = urlFor(article.image)
        .width(700)
        .height(380)
        .fit('max')
        .auto('format')
        .url();

    imageElement.alt = article.title;
}

function renderArticle(article) {
    let title = article.title;
    let content = toHTML(article.body, {components: components});

    titleElement.innerText = title;
    mainElement.innerHTML = content;

    renderPublishedDate(article)
    renderInkersOnDuty(article);
    renderImage(article);

    return;
}

getArticle();