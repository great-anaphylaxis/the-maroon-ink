import { createClient } from "https://esm.sh/@sanity/client?bundle";
import { createImageUrlBuilder } from "https://esm.sh/@sanity/image-url?bundle";
import { getImageDimensions } from "https://esm.sh/@sanity/asset-utils";
import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe.esm.js';

import { hideLoadingScreen, optionsButtonClick, showLoadingScreen, navtop } from "../utils/nav.js";
import { SanityImageInit, urlFor } from "../utils/image-url-builder.js";
import { log } from "../utils/log-events.js";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

SanityImageInit(createImageUrlBuilder, client)

let pageFlip;
let canPageScroll = true;

function getPublishedPaperLinkName() {
    let path =  window.location.pathname;
    let str = path.split('/');

    return str[2];
}

function getPublishedPaper() {
    optionsButtonClick(true, false);
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

        renderPublishedPaper(publishedPaper);

        log(`"${document.title}" published paper page loaded`)
    });
}

function getPublishedPaperPreview(publishedPaper) {
    if (publishedPaper.subtitle) {
        return publishedPaper.subtitle;
    }

    return;
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
            <a class="page-content" data-pswp-src="${url}" data-pswp-width="${dim.width}" data-pswp-height="${dim.height}">
                <img class="page-img" src="${url}" alt="Page">
            </a>
        `;
        container.appendChild(page);
    });

    document.getElementsByClassName('page-img')[0].onload = e => {
        let img1 = document.getElementsByClassName('page-img')[0];
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

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
            gallery: '.stf__block',
            children: '.page',
            showHideAnimationType: 'zoom',
            pswpModule: PhotoSwipe,
            loop: false
        });

        lightbox.on('change', () => {
            const { pswp } = lightbox;

            const newIndex = pswp.currIndex;
            console.log(pageFlip)
            const oldIndex = pageFlip.getCurrentPageIndex();

            if (window.innerWidth >= 1200) {
                if (newIndex > oldIndex + 1 || (newIndex == 1 && oldIndex == 0)) {
                    changeControlButtonState(prevBtn, true);
                    changeControlButtonState(nextBtn, true);

                    pageFlip.flip(newIndex);
                    pageFlipSoundEffect();

                    if (pageFlip.getCurrentPageIndex() >= pageFlip.getPageCount() - 2) {
                        changeControlButtonState(nextBtn, false);
                    }
                }

                if (newIndex < oldIndex) {
                    if (pageFlip.getCurrentPageIndex() == 0) {
                        changeControlButtonState(prevBtn, false);
                    }

                    changeControlButtonState(prevBtn, true);
                    changeControlButtonState(nextBtn, true);

                    pageFlip.flip(newIndex);
                    pageFlipSoundEffect();
                }
            }

            else {
                if (newIndex > oldIndex) {
                    changeControlButtonState(prevBtn, true);
                    changeControlButtonState(nextBtn, true);

                    pageFlip.flip(newIndex);
                    pageFlipSoundEffect();

                    if (pageFlip.getCurrentPageIndex() >= pageFlip.getPageCount() - 2) {
                        changeControlButtonState(nextBtn, false);
                    }
                }

                if (newIndex < oldIndex) {
                    if (pageFlip.getCurrentPageIndex() == 0) {
                        changeControlButtonState(prevBtn, false);
                    }

                    changeControlButtonState(prevBtn, true);
                    changeControlButtonState(nextBtn, true);

                    pageFlip.flip(newIndex);
                    pageFlipSoundEffect();
                }
            }

        })

        lightbox.on('beforeOpen', () => {
            canPageScroll = false;
        });

        lightbox.on('close', () => {
            canPageScroll = true;
        });

        lightbox.init();

        setProperSEO(publishedPaper)
        hideLoadingScreen();
    }

}

function controlsHandler(pageFlip) {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const backBtn = document.getElementById('backBtn');
    const flipbook = document.getElementById('flipbook-wrapper');
    const wrapper = flipbook.style;

    let canScroll = true;
    
    pageFlip.on('flip', (e) => {
        changeControlButtonState(prevBtn, true);
        changeControlButtonState(nextBtn, true);

        if (pageFlip.getCurrentPageIndex() == 0) {
            changeControlButtonState(prevBtn, false);
        }


        else if (pageFlip.getCurrentPageIndex() >= pageFlip.getPageCount() - 1) {
            changeControlButtonState(nextBtn, false);
        }
    });

    if (pageFlip.getCurrentPageIndex() == 0) {
        changeControlButtonState(prevBtn, false);
    }
    
    prevBtn.onclick = () => {
        if (pageFlip.getCurrentPageIndex() == 0) {
            changeControlButtonState(prevBtn, false);
        }

        changeControlButtonState(prevBtn, true);
        changeControlButtonState(nextBtn, true);

        pageFlip.flipPrev();
        pageFlipSoundEffect();
    };

    nextBtn.onclick = () => {
        changeControlButtonState(prevBtn, true);
        changeControlButtonState(nextBtn, true);

        pageFlip.flipNext();
        pageFlipSoundEffect();

        if (pageFlip.getCurrentPageIndex() >= pageFlip.getPageCount() - 2) {
            changeControlButtonState(nextBtn, false);
        }
    };

    backBtn.onclick = () => {
        showLoadingScreen();
        
        window.location.href = "/published-papers";

        setTimeout(e => {
            hideLoadingScreen();
        }, 600);
        
    };

    window.addEventListener('wheel', e => {
        let delta = e.deltaY;

        if (!canScroll) {
            return;
        }

        if (!canPageScroll) {
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
    });
}

function setProperSEO(publishedPaper) {
    const metaDescription = document.querySelector("meta[name='description']");
    const ogUrl = document.querySelector("meta[property='og:url']");
    const ogTitle = document.querySelector("meta[property='og:title']");
    const ogDescription = document.querySelector("meta[property='og:description']");
    const ogImage = document.querySelector("meta[property='og:image']");

    const url = window.location.href;
    const title = `${publishedPaper.title} | The Maroon Ink Published Papers`;
    const description = getPublishedPaperPreview(publishedPaper) || ogDescription.getAttribute('content');
    const image = document.getElementsByClassName('page-img')[0].src;

    ogUrl.setAttribute('content', url)
    document.title = title;
    ogTitle.setAttribute('content', title);
    metaDescription.setAttribute('content', description);
    ogDescription.setAttribute('content', description);
    ogImage.setAttribute('content', image);
}

function pageFlipSoundEffect() {
    const files = ['flip-page-1.mp3', 'flip-page-2.mp3'];
    const path = '/src/audio/';

    const chosenAudio = files[Math.floor(Math.random() * files.length)]
    const finalPath = path + chosenAudio;

    const audio = new Audio(finalPath);
    audio.play();
}

function changeControlButtonState(e, state) {
    if (!state) {
        e.style.opacity = '0.3';
        e.style.pointerEvents = 'none';
    }

    else if (state) {
        e.style.opacity = '1';
        e.style.pointerEvents = 'auto';
    }
}

getPublishedPaper();