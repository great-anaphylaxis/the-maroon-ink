import { createClient } from "https://esm.sh/@sanity/client?bundle";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url?bundle";

import { hideLoadingScreen, initializeSubnav, showLoadingScreen } from "../utils/nav.js";
import { renderPreview, renderPublishedDate, renderTitle, renderType } from "../utils/list-of-articles.js";
import { SanityImageInit, urlFor } from "../utils/image-url-builder.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

SanityImageInit(createImageUrlBuilder, client)

const mainElement = document.getElementById('list');
const subnavElement = document.getElementById('subnav');

let savedQueryData;
const blocks = {};
const blockOrder = [];
const years = {};

function getArticles() {
    showLoadingScreen();

    const articles = client.fetch(`
        *[_type == "article"] | order(publishedAt desc) {
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
        }`);

    articles.then(e => {
        let yearOrder = 0;

        savedQueryData = e;

        for (let i = 0; i < e.length; i++) {
            const article = e[i];
            const date = new Date(article.publishedAt)
            const formattedDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(date);
            const block = blocks[formattedDate];
            const year = date.getFullYear();

            if (!years[year]) {
                years[year] = {
                    year: year,
                    count: 0,
                    order: yearOrder
                };

                yearOrder++;
            }

            if (!block) {
                const currentBlockOrder = blockOrder[blockOrder.length - 1];

                if (currentBlockOrder) {
                    currentBlockOrder.title.innerText += ` (${currentBlockOrder.length})`;
                }

                blocks[formattedDate] = {};

                let obj = blocks[formattedDate];
                blockOrder.push(obj)

                obj.length = 0;
                obj.title = addBlockTitle(formattedDate);
            }

            years[year].count++;
            blocks[formattedDate].length++;
        }

        initializeSubnavButtons();

        initializeSubnav(changeArticleFeed);
        
        hideLoadingScreen();
    });
}

function renderArticle(article) {
    let a = document.createElement('a');
    a.href = '/articles/' + article.linkName.current;

    let art = document.createElement('article');
    art.classList.add('articles');

    let div = document.createElement('div');

    let img = document.createElement('img');
        
    img.alt = article.title;
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

function addBlockTitle(name) {
    const h2 = document.createElement('h2');

    h2.innerText = name;

    mainElement.appendChild(h2);

    return h2;
}

function changeArticleFeed(yearInput) {
    mainElement.textContent = '';

    let buffer;

    for (let i = 0; i < savedQueryData.length; i++) {
        const article = savedQueryData[i];
        const date = new Date(article.publishedAt)
        const formattedDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(date);
        const year = date.getFullYear();

        if (year != yearInput && yearInput != 'all') {
            continue;
        }

        if (buffer != formattedDate) {
            addBlockTitle(`${formattedDate} (${blocks[formattedDate].length})`);
            buffer = formattedDate;
        }

        renderArticle(article)
    }
}

function initializeSubnavButtons() {
    const yearOrder = Object.values(years).sort((a, b) => a.order - b.order);
    let total = 0;

    for (let i = 0; i < yearOrder.length; i++) {
        const year = yearOrder[i].year;
        const count = yearOrder[i].count;

        const a = document.createElement('span');

        a.dataset.value = year;
        a.innerText = `${year} (${count})`;

        subnavElement.appendChild(a);

        total += count;
    }

    const a1 = document.createElement('span');

    a1.dataset.value = 'all';
    a1.innerText = `All (${total})`;

    subnavElement.prepend(a1);
}

getArticles();
