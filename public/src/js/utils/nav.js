export const navtop = document.getElementById('navtop');
const navside = document.getElementById('navside');
const subnav = document.getElementById('subnav');
const optionsButton = document.getElementById('options-icon');
const searchbox = document.getElementById('searchbox');
const loadingscreen = document.getElementById('loadingscreen');
const navsideFooterCopyright = document.getElementById('navside-footer-copyright');

let currentSubnavButton;
let subNavOnclickHandler;

let pastScrollPos = 0;
let scrollPos = 0;
let hidden = false;
let rememberHidden = false;

function onscroll() {
    if (hidden || rememberHidden) {
        rememberHidden = true;
    }

    if (window.innerWidth >= 950 && (navtop.style.animation == "0.4s ease 0s 1 normal forwards running navbar-show"
        || navtop.style.animation == "")
    ) {
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

            if (subnav) {
                subnav.style.animation = "0.4s ease 0s 1 normal forwards running subnav-hide";
            }
        }
    
        else {
            navtop.style.animation = "0.4s ease 0s 1 normal forwards running navbar-show";

            if (subnav) {
                subnav.style.animation = "0.4s ease 0s 1 normal forwards running subnav-show";
            }
        }
    });
}

function onresize() {
    if (hidden) {
        return;
    }

    if (window.innerWidth < 950) {
        navside.style.left = "-225px";
        document.styleSheets[0].deleteRule(0)
        document.styleSheets[0].insertRule(
            '#content::before { flex-basis: 0px !important; }', 0);

        hidden = false;
    }
    
    if (window.innerWidth >= 950) {
        if (hidden) {
            navside.style.animation = "0.4s ease 0s 1 normal forwards running navside-hide";

            if (window.innerWidth >= 950) {
                document.styleSheets[0].deleteRule(0)
                document.styleSheets[0].insertRule(
                    '#content::before { animation: 0.4s ease 0s 1 normal forwards running navside-hide2 }', 0);
            }
        }

        else {
            navside.style.animation = "0.4s ease 0s 1 normal forwards running navside-show";

            if (window.innerWidth >= 950) {
                document.styleSheets[0].deleteRule(0)
                document.styleSheets[0].insertRule(
                    '#content::before { animation: 0.4s ease 0s 1 normal forwards running navside-show2 }', 0);
            }
        }
    }
}

export function optionsButtonClick(value, save=true) {
    hidden = value ?? !hidden;

    if (save) {
        localStorage.setItem('navside.hidden', "" + hidden);
    }

    if (hidden) {
        navside.style.animation = "0.4s ease 0s 1 normal forwards running navside-hide";

        if (window.innerWidth >= 950) {
            document.styleSheets[0].deleteRule(0)
            document.styleSheets[0].insertRule(
                '#content::before { animation: 0.4s ease 0s 1 normal forwards running navside-hide2 }', 0);
        }
    }

    else {
        navside.style.animation = "0.4s ease 0s 1 normal forwards running navside-show";

        if (window.innerWidth >= 950) {
            document.styleSheets[0].deleteRule(0)
            document.styleSheets[0].insertRule(
                '#content::before { animation: 0.4s ease 0s 1 normal forwards running navside-show2 }', 0);
        }
    }
}

function initializeNavside() {
    const anchors = navside.querySelectorAll('a');

    let localHidden = localStorage.getItem('navside.hidden') ?? 'false';


    if (window.innerWidth < 950) {
        localHidden = 'true';
    }

    if (localHidden == 'true') {
        navside.style.left = "-225px";
        document.styleSheets[0].insertRule(
            '#content::before { flex-basis: 0px !important; }', 0);

        hidden = true;
    }

    navside.style.display = 'block';

    for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        const link = anchor.getAttribute('href');
        const path = window.location.pathname;
        
        if (link == path) {
            anchor.classList.add('current');
        }
    }

    navsideFooterCopyright.innerText = `© ${new Date().getFullYear()} The Maroon Ink.`;

    optionsButton.addEventListener('click', e=>optionsButtonClick())
}

function onSearchboxEnter(e) {
    let value = searchbox.value;

    if (value.length > 0 && (e.key === "Enter" || e.keyCode === 13)) {
        window.location.href = "/search?q=" + value;
    }
}

function subnavOnclick(e) {
    let name = e.dataset.value;

    if (currentSubnavButton) {
        currentSubnavButton.classList.remove("current")
    }
    
    currentSubnavButton = e;

    e.classList.add("current");

    subNavOnclickHandler(name);

    window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto'
    });
}

export function initializeSubnav(func) {
    let buttons = subnav.querySelectorAll('span');

    subNavOnclickHandler = func

    for (let i = 0; i < buttons.length; i++) {
        let button = buttons[i];

        button.addEventListener('click', e => {
            subnavOnclick(button);
        });

        if (i == 0) {
            subnavOnclick(button);
        }
    }
}

export function hideLoadingScreen() {
    loadingscreen.style.display = 'none';
}

export function showLoadingScreen() {
    loadingscreen.style.display = 'block';
}


window.onscroll = onscroll;
window.onresize = onresize;

initializeNavside();

searchbox.addEventListener('keydown', onSearchboxEnter);