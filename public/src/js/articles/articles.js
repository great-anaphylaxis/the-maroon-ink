import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe.esm.js';
import PhotoSwipeVideoPlugin from 'https://cdn.jsdelivr.net/npm/photoswipe-video-plugin@1.0.2/+esm'

function initPhotoSwipe(article) {
    const lightbox = new PhotoSwipeLightbox({
        gallery: '#media',
        children: 'a',
        pswpModule: PhotoSwipe
    });

    const videoPlugin = new PhotoSwipeVideoPlugin(lightbox, {
        // options
    });

    
    lightbox.init();
}

function onhashchange() {
    let options = {
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
    };

    let hash = window.location.hash.slice(1);

    history.replaceState("", document.title, window.location.pathname + window.location.search);

    const e = document.querySelector(hash)
    
    if (e) {
        e.scrollIntoView(options);
    }
}

window.onhashchange = onhashchange;

initPhotoSwipe()