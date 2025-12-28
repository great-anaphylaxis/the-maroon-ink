

const navtop = document.getElementById('navtop');
const navside = document.getElementById('navside');
const content = document.getElementById('content');
const optionsButton = document.getElementById('options-icon');
const searchbox = document.getElementById('searchbox');

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

    localStorage.setItem('navside.hidden', "" + hidden);

    if (hidden) {
        navside.style.animation = "0.4s ease 0s 1 normal forwards running navside-hide";
        document.styleSheets[0].deleteRule(0)
        document.styleSheets[0].insertRule(
            '#content::before { animation: 0.4s ease 0s 1 normal forwards running navside-hide2 }', 0);
    }

    else {
        navside.style.animation = "0.4s ease 0s 1 normal forwards running navside-show";
        document.styleSheets[0].deleteRule(0)
        document.styleSheets[0].insertRule(
            '#content::before { animation: 0.4s ease 0s 1 normal forwards running navside-show2 }', 0);
    }
}

function initializeNavside() {
    let localHidden = localStorage.getItem('navside.hidden') ?? 'false';

    if (localHidden == 'true') {
        navside.style.left = "-200px";
        document.styleSheets[0].insertRule(
            '#content::before { flex-basis: 0px !important; }', 0);

        hidden = true;
    }

    navside.style.display = 'block';

    optionsButton.addEventListener('click', optionsButtonClick)
}

function onSearchboxEnter(e) {
    let value = searchbox.value;

    if (value.length > 0 && (e.key === "Enter" || e.keyCode === 13)) {
        window.location.href = "/search?q=" + value;
    }
}


window.onscroll = onscroll;

initializeNavside();

searchbox.addEventListener('keydown', onSearchboxEnter);