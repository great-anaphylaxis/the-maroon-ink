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

const mainElement = document.getElementById('main');

function urlFor(source) {
    return builder.image(source);
}

function getArticles() {
    showLoadingScreen();

    const articles = client.fetch(`
        *[_type == "article"] | order(publishedAt desc) {
            title,
            subtitle,
            linkName,
            publishedAt,
            image,
            body
        }`);

    articles.then(e => {
        const res = {};

        console.log(e);

        return;

        Object.keys(res).forEach(key => {
            const staff = res[key];

            addRoleTitle(key);
            renderStaff(staff);
        });
        
        hideLoadingScreen();
    });
}

function renderStaff(staff) {
    const stafflist = document.createElement('div');
    stafflist.classList.add('stafflist');

    for (let i = 0; i < staff.length; i++) {
        let inker = staff[i];

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

        let h3 = document.createElement('h3');
        h3.innerText = name;

        let p = document.createElement('p');
        p.innerText = role;

        divParent.appendChild(h3);
        divParent.appendChild(p);

        art.appendChild(img);
        art.appendChild(divParent);

        a.appendChild(art);

        stafflist.appendChild(a);
    }

    mainElement.appendChild(stafflist)
}

function addRoleTitle(name) {
    const h2 = document.createElement('h2');

    h2.innerText = name;

    mainElement.appendChild(h2);
}

getArticles();