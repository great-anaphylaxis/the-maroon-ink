import { createClient } from "https://esm.sh/@sanity/client?bundle";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url?bundle";

import { hideLoadingScreen, showLoadingScreen } from "../utils/nav.js";
import { renderPreview, renderPublishedDate, renderTitle, renderType } from "../utils/list-of-articles.js";
import { SanityImageInit, urlFor } from "../utils/image-url-builder.js";
import { log } from "../utils/log-events.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

SanityImageInit(createImageUrlBuilder, client)

const mainElement = document.getElementById('main');
const titleElement = document.getElementById('title');

let searchQuery = "";

function getSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    searchQuery = query;
}

function setTitle() {
    titleElement.innerText = "Results for " + searchQuery;
}

function getSearchResults() {
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
            body[0...1],

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

        log("Search page loaded");
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
                .width(300)
                .height(200)
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
