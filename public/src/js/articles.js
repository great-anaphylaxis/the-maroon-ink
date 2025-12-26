import { createClient } from "https://esm.sh/@sanity/client";
import { toHTML, uriLooksSafe } from "https://esm.sh/@portabletext/to-html";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

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
const mainElement = document.getElementById('main');

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

    for (let i = 0; i < article.inkersOnDuty.length; i++) {
        let inkers = article.inkersOnDuty[i];

        let name = inkers.name;

        inkersOnDuty.push(name)
    }

    inkersElement.innerText = "By: " + inkersOnDuty.join(", ");
}

function renderArticle(article) {
    let title = article.title;
    let publishedDate = new Date(article.publishedAt).toLocaleString();
    let content = toHTML(article.body, {components: components});

    titleElement.innerText = title;
    dateElement.innerText = publishedDate;
    mainElement.innerHTML = content;

    renderInkersOnDuty(article);

    console.log(article)

    return;
}

getArticle();