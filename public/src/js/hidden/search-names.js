import { createClient } from "https://esm.sh/@sanity/client?bundle";
import { hideLoadingScreen } from "../utils/nav.js";
import { log } from "../utils/log-events.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const searchnames = document.getElementById('searchnames');
const articleList = document.getElementById('articleList');

let names = [];

function getNames() {
    let query = `*[_type == "inker"] {
        name,
        "username": "/inkers/" + username.current
    }`;

    client.fetch(query).then(res => {
        names = res;

        renderNames();
        hideLoadingScreen();
    });

    log("Search name page loaded");
}

function renderNames() {
    articleList.innerHTML = "";

    let value = searchnames.value;
    
    let filteredNames = names.filter(name => name.name.toLowerCase().includes(value.toLowerCase()));

    filteredNames.sort((a, b) => a.name.localeCompare(b.name));

    filteredNames.sort((a, b) => {
        let aStartsWith = a.name.toLowerCase().startsWith(value.toLowerCase());
        let bStartsWith = b.name.toLowerCase().startsWith(value.toLowerCase());
        if (aStartsWith && !bStartsWith) {
            return -1;
        } else if (!aStartsWith && bStartsWith) {
            return 1;
        } else {
            return 0;
        }
    });

    for (let i = 0; i < filteredNames.length; i++) {
        let name = filteredNames[i];
        let nameElement = document.createElement('a');
        
        nameElement.target = "_self";
        nameElement.href = name.username;
        nameElement.innerText = name.name;
        nameElement.classList.add("names");

        articleList.appendChild(nameElement);
    }

    if (filteredNames.length == 0) {
        let noResults = document.createElement('p');
        noResults.classList.add("no-results");

        noResults.innerText = "No results found. The inker may be new! Try searching for just their first or last name to verify that they are a new inker.";

        articleList.appendChild(noResults);
    }
}

searchnames.addEventListener('keyup', renderNames);

getNames();