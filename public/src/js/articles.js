import { createClient } from "https://esm.sh/@sanity/client";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url";
import { toHTML, uriLooksSafe } from "https://esm.sh/@portabletext/to-html";
import { hideLoadingScreen, showLoadingScreen } from "./nav.js";

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
const imageElement = document.getElementById('image');
const mainElement = document.getElementById('main');
const inkersOnDutyElement = document.getElementById('inkers-on-duty');

function urlFor(source) {
    return builder.image(source);
}

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
        image,
        body
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

    if (!article.inkersOnDuty) {
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

    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    if (article.image) {
        try {        
            imageElement.src = urlFor(article.image)
                .width(600)
                .height(400)
                .fit('max')
                .auto('format')
                .url();
        }
        catch {
            console.error("ERROR")
        }

        imageElement.alt = article.title;
    }
}

function renderArticle(article) {
    let title = article.title;
    let subtitle = article.subtitle;
    let content = toHTML(article.body, {components: components});

    titleElement.innerText = title;
    subtitleElement.innerText = subtitle;
    mainElement.innerHTML = content;

    renderPublishedDate(article)
    renderContributors(article);
    renderImage(article);

    renderInkersOnDuty(article);

    return;
}

function getArticlePreview(article) {
    if (article.subtitle) {
        return article.subtitle;
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

        return finalTarget.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
    }

    return;
}

function setProperSEO(article) {
    const metaDescription = document.querySelector("meta[name='description']");
    const ogUrl = document.querySelector("meta[property='og:url']");
    const ogTitle = document.querySelector("meta[property='og:title']");
    const ogDescription = document.querySelector("meta[property='og:description']");
    const ogImage = document.querySelector("meta[property='og:image']");

    const url = window.location.href;
    const title = `${article.title} | The Maroon Ink Articles`;
    const description = getArticlePreview(article)
    const image = imageElement.src;

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

    document.querySelector(hash).scrollIntoView(options);
}

getArticle();

window.onhashchange = onhashchange;