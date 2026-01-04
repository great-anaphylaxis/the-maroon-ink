import { createClient } from "https://esm.sh/@sanity/client";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url";
import { getImageDimensions  } from "https://esm.sh/@sanity/asset-utils";
import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe.esm.js';
import { hideLoadingScreen, optionsButtonClick, showLoadingScreen, navtop } from "./nav.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

const titleElement = document.getElementById('title');
const subtitleElement = document.getElementById('subtitle');
const inkersElement = document.getElementById('inkers');
const dateElement = document.getElementById('date');
const imageElement = document.getElementById('image');
const mainElement = document.getElementById('main');
const inkersOnDutyElement = document.getElementById('inkers-on-duty');
const footerElement = document.getElementById('footer');
const footerHr = document.getElementById('footerHr');
const articleInfoDivider = document.getElementById('article-info-divider');

const builder = createImageUrlBuilder(client)

let pageFlip;

function urlFor(source) {
    return builder.image(source)
}

function getPublishedPaperLinkName() {
    let path =  window.location.pathname;
    let str = path.split('/');

    return str[2];
}

function getPublishedPaper() {
    showLoadingScreen();

    optionsButtonClick(true);
    navtop.style.animation = "0.4s ease 0s 1 normal forwards running navbar-hide";

    const linkName = getPublishedPaperLinkName();

    const publishedPaper = client.fetch(`*[_type == "publishedPaper" && linkName.current == $linkName]{
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
    }`, {linkName: linkName});

    publishedPaper.then(e => {
        let publishedPaper = e[0];

        if (e.length == 0) {
            window.location.replace("/404.html");
        }

        // setProperSEO(publishedPaper)
        
        renderPublishedPaper(publishedPaper)

        hideLoadingScreen();
    });
}

function renderContributors(article) {
    let inkersOnDuty = [];
    let str = "";

    if (!article.inkersOnDuty || article.inkersOnDuty.length == 0) {
        footerElement.style.display = 'none';
        footerHr.style.display = 'none';
        articleInfoDivider.style.display = 'none';


        return;
    }

    for (let i = 0; i < article.inkersOnDuty.length; i++) {
        let inkers = article.inkersOnDuty[i];

        let name = inkers.name;

        inkersOnDuty.push(name)
    }

    let count = inkersOnDuty.length;

    if (count === 1) {
        str = `By: ${inkersOnDuty[0]}`;
    } else if (count === 2) {
        str = `By: ${inkersOnDuty[0]} & ${inkersOnDuty[1]}`;
    } else if (count === 3) {
        str = `By: ${inkersOnDuty[0]}, ${inkersOnDuty[1]}, & 1 other`;
    } else if (count > 3) {
        const remaining = count - 2;
        str = `By: ${inkersOnDuty[0]}, ${inkersOnDuty[1]}, & ${remaining} others`;
    }

    inkersElement.innerText = str;
}

function renderInkersOnDuty(article) {
    if (!article.inkersOnDuty) {
        return;
    }

    for (let i = 0; i < article.inkersOnDuty.length; i++) {
        let inkers = article.inkersOnDuty[i];

        let name = inkers.name;
        let username = inkers.username.current;
        let role = inkers.role;
        let profilePicture = inkers.profilePicture;

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

        inkersOnDutyElement.appendChild(a);
    }
}

function renderPublishedDate(article) {
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
        dateElement.innerText = `Yesterday at ${timePart}`;
    } else if (isSameYear) {
        dateElement.innerText = `${monthDay} at ${timePart}`;
    } else {
        dateElement.innerText = `${monthDay}, ${yearPart}`;
    }
}

function renderImage(article) {
    if (article.image) {
        try {        
            imageElement.src = urlFor(article.image)
                .width(600)
                .height(400)
                .fit('max')
                .auto('format')
                .url();
        }
        catch {
            console.error("ERROR")
        }

        imageElement.alt = article.title;
    }
}

function getPublishedPaperPages(publishedPaper) {
    let pages = publishedPaper.pages;
    let arr = []

    for (let i = 0; i < pages.length; i++) {
        arr.push(urlFor(pages[i]).url());
    }

    return arr;
}

function renderPublishedPaper(publishedPaper) {
    const imageUrls = getPublishedPaperPages(publishedPaper);

    const container = document.getElementById('flipbook-container');


    imageUrls.forEach((url) => {
        const page = document.createElement('div');
        const dim = getImageDimensions(url);

        page.className = 'page';
        page.innerHTML = `
            <a class="page-content" href="${url}" data-pswp-width="${dim.width}" data-pswp-height="${dim.height}">
                <img class="page-img" src="${url}" alt="Page">
            </a>
        `;
        container.appendChild(page);
    });

    document.getElementsByClassName('page-img')[0].onload = e => {
        let img1 = document.getElementsByClassName('page-img')[0];

        const width = img1.naturalWidth;
        const height = img1.naturalHeight;
        const imgAspectRatio = width / height;

        let pageWidth;
        let pageHeight;
        let usePortrait;

        if (window.innerWidth > window.innerHeight) {
            pageWidth = (window.innerHeight - 70) * imgAspectRatio;
            pageHeight = (window.innerHeight - 70);
        }

        else if (window.innerWidth <= window.innerHeight) {
            pageWidth = (window.innerWidth) - 20;
            pageHeight = (window.innerWidth - 20) / imgAspectRatio;
        }

        if (window.innerWidth >= 1200) {
            usePortrait = false;
        }

        else if (window.innerWidth >= 640) {
            usePortrait = true;
        }

        else {

            usePortrait = true;
        }

        pageFlip = new St.PageFlip(container, {
            width: pageWidth,
            height: pageHeight,
            maxShadowOpacity: 0.5,
            usePortrait: usePortrait,
            showCover: true,
            mobileScrollSupport: true,
            flippingTime: 500
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.page'));

        controlsHandler(pageFlip);

        const lightbox = new PhotoSwipeLightbox({
            gallery: '.page a',
            pswpModule: PhotoSwipe
        });

        lightbox.init();
    }

}

function getArticlePreview(article) {
    if (article.subtitle) {
        return article.subtitle;
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

        return finalTarget.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
    }

    return;
}

function controlsHandler(pageFlip) {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const backBtn = document.getElementById('backBtn');
    const flipbook = document.getElementById('flipbook-wrapper');
    const wrapper = flipbook.style;

    let canScroll = true;

    if (window.innerWidth >= 1200) {
        wrapper.animation = "";
        wrapper.animation = "0.8s ease 0s 1 normal forwards running flipbook-transition-to-one-start";
    }
    
    pageFlip.on('flip', (e) => {
        prevBtn.disabled = false;
        nextBtn.disabled = false;

        if (pageFlip.getCurrentPageIndex() == 0) {
            prevBtn.disabled = true;
                
            if (window.innerWidth >= 1200) {
                wrapper.animation = "";
                wrapper.animation = "0.8s ease 0s 1 normal forwards running flipbook-transition-to-one-start";
            }
        }


        else if (pageFlip.getCurrentPageIndex() >= pageFlip.getPageCount() - 1) {
            nextBtn.disabled = true;

            if (window.innerWidth >= 1200) {
                wrapper.animation = "";
                wrapper.animation = "0.8s ease 0s 1 normal forwards running flipbook-transition-to-one-end";
            }
        }

        else { 
            if (window.innerWidth >= 1200) {
                if (pageFlip.getCurrentPageIndex() >= pageFlip.getPageCount() - 3 &&
                    wrapper.animation == "0.8s ease 0s 1 normal forwards running flipbook-transition-to-one-end"
                ) {
                    wrapper.animation = "";
                    wrapper.animation = "0.8s ease 0s 1 normal forwards running flipbook-transition-to-two-end";
                }

                else if (pageFlip.getCurrentPageIndex() == 1 &&
                    wrapper.animation == "0.8s ease 0s 1 normal forwards running flipbook-transition-to-one-start"
                ) {
                    wrapper.animation = "";
                    wrapper.animation = "0.8s ease 0s 1 normal forwards running flipbook-transition-to-two-start";
                }
            }
        }
    });

    if (pageFlip.getCurrentPageIndex() == 0) {
        prevBtn.disabled = true;
    }
    
    prevBtn.onclick = () => {
        if (pageFlip.getCurrentPageIndex() == 0) {
            prevBtn.disabled = true;
        }

        prevBtn.disabled = false;
        nextBtn.disabled = false;

        pageFlip.flipPrev();
    };

    nextBtn.onclick = () => {
        prevBtn.disabled = false;
        nextBtn.disabled = false;

        pageFlip.flipNext()

        if (pageFlip.getCurrentPageIndex() >= pageFlip.getPageCount() - 2) {
            nextBtn.disabled = true;
        }
    };

    backBtn.onclick = () => window.history.back();

    window.addEventListener('wheel', e => {
        let delta = e.deltaY;

        if (!canScroll) {
            return;
        }

        if (Math.sign(delta) == -1) {
            prevBtn.onclick();
        }

        else if (Math.sign(delta) == 1) {
            nextBtn.onclick();
        }

        canScroll = false;

        setTimeout(e => {
            canScroll = true
        }, 350);
    })
}

function setProperSEO(publishedPaper) {
    const metaDescription = document.querySelector("meta[name='description']");
    const ogUrl = document.querySelector("meta[property='og:url']");
    const ogTitle = document.querySelector("meta[property='og:title']");
    const ogDescription = document.querySelector("meta[property='og:description']");
    const ogImage = document.querySelector("meta[property='og:image']");

    const url = window.location.href;
    const title = `${publishedPaper.title} | The Maroon Ink Published Papers`;
    const description = getArticlePreview(article)
    const image = imageElement.src;

    ogUrl.setAttribute('content', url)
    document.title = title;
    ogTitle.setAttribute('content', title);
    metaDescription.setAttribute('content', description);
    ogDescription.setAttribute('content', description);
    ogImage.setAttribute('content', image);
}

getPublishedPaper();