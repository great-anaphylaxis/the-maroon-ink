import { createClient } from "https://esm.sh/@sanity/client";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const builder = createImageUrlBuilder(client);

const imgElement = document.getElementById('img');
const nameElement = document.getElementById('name');
const roleElement = document.getElementById('role');
const bioElement = document.getElementById('bio');

const mainElement = document.getElementById('main');

function urlFor(source) {
    return builder.image(source);
}

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
        title,
        subtitle,
        linkName,
        publishedAt,
        image,
        body
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
    });
}

function renderInker(inker) {
    imgElement.src = urlFor(inker.profilePicture)
        .width(150)
        .height(150)
        .fit('max')
        .auto('format')
        .url();

    imgElement.alt = inker.name;


    nameElement.innerText = inker.name;
    roleElement.innerText = inker.role;
    bioElement.innerText = inker.bio;
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

function renderArticle(article) {
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
    const image = imgElement.src;

    ogUrl.setAttribute('content', url)
    document.title = title;
    ogTitle.setAttribute('content', title);
    metaDescription.setAttribute('content', description);
    ogDescription.setAttribute('content', description);
    ogImage.setAttribute('content', image);
}

getInkerAndArticles();