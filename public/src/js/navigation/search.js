import { createClient } from "https://esm.sh/@sanity/client";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url";

import { hideLoadingScreen, showLoadingScreen } from "../utils/nav.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const builder = createImageUrlBuilder(client);

const mainElement = document.getElementById('main');
const titleElement = document.getElementById('title');

let searchQuery = "";

function urlFor(source) {
    return builder.image(source);
}

function getSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    searchQuery = query;
}

function setTitle() {
    titleElement.innerText = "Results for " + searchQuery;
}

function getSearchResults() {
    showLoadingScreen();
    
    const searchResults = client.fetch(`
        *[
            (_type == "article" || _type == "inker") && 
            (title match "*" + $searchQuery + "*" || 
            subtitle match "*" + $searchQuery + "*" ||
            name match "*" + $searchQuery + "*" || 
            "*" + body[].children[].text match $searchQuery + "*" || 
            "*" + role match $searchQuery + "*")
        ] | order(name asc, publishedAt desc) {
        _type == "article" => {
            "_type": "article",
            title,
            subtitle,
            linkName,
            publishedAt,
            image,
            body,

            "relevance": select(
                title match $searchQuery => 100,
                subtitle match $searchQuery => 90,
                string::startsWith(lower(title), lower($searchQuery)) => 86,
                string::startsWith(lower(subtitle), lower($searchQuery)) => 83,
                title match $searchQuery + "*" => 80,
                subtitle match $searchQuery + "*" => 70,
                title match "*" + $searchQuery + "*" => 60,
                subtitle match "*" + $searchQuery + "*" => 50,
                0
            )
        },
        _type == "inker" => {
            "_type": "inker",
            name,
            username,
            profilePicture,
            role,

            "relevance": select(
                name match $searchQuery => 100,
                string::startsWith(lower(name), lower($searchQuery)) => 86,
                string::startsWith(lower(role), lower($searchQuery)) => 83,
                name match $searchQuery + "*" => 81,
                role match $searchQuery => 80,
                name match "*" + $searchQuery + "*" => 70,
                role match $searchQuery + "*" => 60,
                role match "*" + $searchQuery + "*" => 50,
                0
            )
        }
    } | order(relevance desc)`, {searchQuery: searchQuery});

    searchResults.then(e => {
        for (let i = 0; i < e.length; i++) {
            let searchResult = e[i];
            
            renderSearchResult(searchResult);
        }

        if (e.length == 0) {
            titleElement.innerText = `Your search - ${searchQuery} - did not match any results`;
            mainElement.removeChild(mainElement.lastElementChild);
        }
        
        hideLoadingScreen();
    });
}

function renderSearchResult(searchResult) {
    let type = searchResult._type;

    if (type == "inker") {
        renderInker(searchResult)
    }

    if (type == "article") {
        renderArticle(searchResult);
    }
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
        
    img.alt = article.title;
    if (article.image) {
        try {        
            img.src = urlFor(article.image)
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

function renderInker(inker) {
    let name = inker.name;
    let username = inker.username.current;
    let role = inker.role;
    let profilePicture = inker.profilePicture;

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

    let h1 = document.createElement('h1');
    h1.innerText = name;

    let h2 = document.createElement('h2');
    h2.innerText = role;

    divParent.appendChild(h1);
    divParent.appendChild(h2);

    art.appendChild(img);
    art.appendChild(divParent);

    a.appendChild(art);

    mainElement.appendChild(a);
}

getSearchQuery();
setTitle();

getSearchResults();
