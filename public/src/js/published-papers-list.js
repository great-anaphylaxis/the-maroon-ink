import { createClient } from "https://esm.sh/@sanity/client";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url";
import { hideLoadingScreen, showLoadingScreen } from "./nav.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const builder = createImageUrlBuilder(client);

const mainElement = document.getElementById('list');

function urlFor(source) {
    return builder.image(source);
}

function getPublishedPapers() {
    showLoadingScreen();

    const publishedPapers = client.fetch(`
        *[_type == "publishedPaper"] | order(publishedAt desc) {
            title,
            subtitle,
            linkName,
            publishedAt,
            pages[]{
                asset->{
                    _id,
                    url
                },
            }
        }`);

    publishedPapers.then(e => {
        for (let i = 0; i < e.length; i++) {
            const publishedPaper = e[i];

            renderPublishedPaper(publishedPaper);
        }
        
        hideLoadingScreen();
    });
}

function renderPublishedPaper(publishedPaper) {
    let a = document.createElement('a');
    a.href = '/published-papers/' + publishedPaper.linkName.current;

    let art = document.createElement('article');
    art.classList.add('articles');

    let div = document.createElement('div');

    let img = document.createElement('img');
        
    img.alt = publishedPaper.title;
    if (publishedPaper.pages) {
        try {        
            img.src = urlFor(publishedPaper.pages[0])
                .width(600)
                .height(400)
                .fit('max')
                .auto('format')
                .url();
        }
        catch {
            console.error("ERROR")
        }
    }

    else {
        img.src = '/src/images/banner.jpg';
    }

    let h1 = document.createElement('h1');
    renderTitle(publishedPaper, h1);

    let h2 = document.createElement('h2');
    renderPreview(publishedPaper, h2);

    let p = document.createElement('p');
    renderPublishedDate(publishedPaper, p);

    div.appendChild(h1);
    div.appendChild(h2);
    div.appendChild(p);

    art.appendChild(div);
    art.appendChild(img);

    a.appendChild(art);

    mainElement.appendChild(a);

    return;
}

function renderPublishedDate(publishedPaper, dateElement) {
    const date = new Date(publishedPaper.publishedAt);
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

function renderPreview(publishedPaper, previewElement) {
    if (publishedPaper.subtitle) {
        previewElement.innerText = publishedPaper.subtitle;
    }

    else {
        return;
    }

    return;
}

function renderTitle(publishedPaper, titleElement) {
    if (publishedPaper.title) {
        let title = publishedPaper.title;
        let maxCharLength = 60;

        let str = title.length > maxCharLength 
            ? title.substring(0, maxCharLength) + "..." 
            : title;

        titleElement.innerText = str;
    }
}

getPublishedPapers();