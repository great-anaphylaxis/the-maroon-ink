import { createClient } from "https://esm.sh/@sanity/client";

import { hideLoadingScreen, showLoadingScreen } from "../utils/nav.js";
import { renderPreview, renderPublishedDate, renderTitle } from "../utils/list-of-articles.js";
import { urlFor } from "../utils/image-url-builder.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const mainElement = document.getElementById('list');

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

getPublishedPapers();