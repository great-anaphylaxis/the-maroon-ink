const nav = document.querySelector('nav');

let pastScrollPos = 0
let scrollPos = 0

function onscroll() {
    window.requestAnimationFrame(() => {
        pastScrollPos = scrollPos;
        scrollPos = document.body.getBoundingClientRect().top * -1;

        let deltaT = Math.abs(scrollPos - pastScrollPos);

        if (deltaT < 1) {
            return;
        }
    
        if (scrollPos > pastScrollPos) {
            nav.style.animation = "0.4s ease 0s 1 normal forwards running navbar-hide";
        }
    
        else {
            nav.style.animation = "0.4s ease 0s 1 normal forwards running navbar-show";
        }
    });
}


window.onscroll = onscroll;