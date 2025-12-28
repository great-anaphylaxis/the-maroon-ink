

const navtop = document.getElementById('navtop');
const navside = document.getElementById('navside');
const content = document.getElementById('content');
const optionsButton = document.getElementById('options-icon');

let pastScrollPos = 0;
let scrollPos = 0;
let hidden = false;

function onscroll() {
    if (window.innerWidth >= 950) {
        return;
    }

    window.requestAnimationFrame(() => {
        pastScrollPos = scrollPos;
        scrollPos = document.body.getBoundingClientRect().top * -1;

        let deltaT = Math.abs(scrollPos - pastScrollPos);

        if (deltaT < 1) {
            return;
        }
    
        if (scrollPos > pastScrollPos) {
            navtop.style.animation = "0.4s ease 0s 1 normal forwards running navbar-hide";
        }
    
        else {
            navtop.style.animation = "0.4s ease 0s 1 normal forwards running navbar-show";
        }
    });
}

function optionsButtonClick() {
    hidden = !hidden;

    if (hidden) {
        navside.style.animation = "0.4s ease 0s 1 normal forwards running navside-hide";
        content.style.animation = "0.4s ease 0s 1 normal forwards running navside-hide2";
    }

    else {
        navside.style.animation = "0.4s ease 0s 1 normal forwards running navside-show";
        content.style.animation = "0.4s ease 0s 1 normal forwards running navside-show2";
    }
}


window.onscroll = onscroll;
optionsButton.addEventListener('click', optionsButtonClick)