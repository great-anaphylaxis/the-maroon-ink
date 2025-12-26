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
const bioElement = document.getElementById('bio');

function urlFor(source) {
    return builder.image(source);
}

function getInkerUsername() {
    let path =  window.location.pathname;
    let str = path.split('/');

    return str[2];
}

function getInker() {
    const username = getInkerUsername();
    const inker = client.fetch(`*[_type == "inker" && username.current == "${username}"]{
        name,
        username,
        profilePicture,
        bio
    }`);

    inker.then(e => {
        for (let i = 0; i < e.length; i++) {
            let inker = e[i];
            
            renderInker(inker)
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
    bioElement.innerText = inker.bio;
}

getInker();