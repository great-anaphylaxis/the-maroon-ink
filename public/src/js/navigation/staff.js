import { createClient } from "https://esm.sh/@sanity/client?bundle";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url?bundle";

import { hideLoadingScreen, showLoadingScreen } from "../utils/nav.js";
import { SanityImageInit, urlFor } from "../utils/image-url-builder.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

SanityImageInit(createImageUrlBuilder, client)

const mainElement = document.getElementById('main');

function getStaff() {
    showLoadingScreen();

    const staff = client.fetch(`{
    "Editor in Chief": *[_type == "inker" && role match "editor in chief"]{
        name,
        username,
        profilePicture,
        role
    },

    "Associate Editor": *[_type == "inker" && role match "associate editor"]{
        name,
        username,
        profilePicture,
        role
    },

    "Editorial Board": *[_type == "inker" && !(role match "editor in chief") && !(role match "associate editor")
    && (role match "lead" || role match "editor" || role match "manager")] | order(lower(role) asc) {
        name,
        username,
        profilePicture,
        role
    },
    
    "Members": *[_type == "inker" && 
    !(role match "lead" || role match "editor" || role match "manager" || role match "adviser")] | order(lower(role) asc) {
        name,
        username,
        profilePicture,
        role
    },
    
    "Adviser": *[_type == "inker" && role match "adviser"]{
        name,
        username,
        profilePicture,
        role
    }}`);

    staff.then(e => {
        // repositioning

        const res = {
            "Editor in Chief": e["Editor in Chief"],
            "Associate Editor": e["Associate Editor"],
            "Editorial Board": e["Editorial Board"],
            "Members": e["Members"],
            "Adviser": e["Adviser"]
        }

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
        img.loading = "lazy";

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

getStaff();