import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.4.3/dist/photoswipe.esm.js';
import { log } from '../utils/log-events.js';

function initPhotoSwipe() {
    const lightbox = new PhotoSwipeLightbox({
        gallery: 'main a',
        pswpModule: PhotoSwipe
    });

    lightbox.init();
}

initPhotoSwipe();

log(`About page loaded`)
