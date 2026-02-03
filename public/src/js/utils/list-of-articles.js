import { hideLoadingScreen, initializeSubnav, showLoadingScreen } from "./nav.js";

export function renderTitle(article, titleElement) {
    if (article.title) {
        let title = article.title;
        let maxCharLength = 60;

        let str = title.length > maxCharLength 
            ? title.substring(0, maxCharLength) + "..." 
            : title;

        titleElement.innerText = str;
    }
}

export function renderPublishedDate(article, dateElement) {
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
        dateElement.innerText = `Yesterday`;
    } else if (isSameYear) {
        dateElement.innerText = `${monthDay}`;
    } else {
        dateElement.innerText = `${monthDay}, ${yearPart}`;
    }
}

export function renderType(article, typeElement) {
    if (article.type) {
        let rawType = article.type;

        if (rawType == "newsandannouncements") {
            typeElement.style.display = 'none';

            return;
        }

        const type = rawType.charAt(0).toUpperCase() + rawType.slice(1);

        typeElement.setAttribute("data-article-type", "true");

        typeElement.innerText = type;

        typeElement.addEventListener("click", e => {
            showLoadingScreen();

            setTimeout(e => {
                window.location.href = "/search?q=" + type;
        
                setTimeout(e => {
                    hideLoadingScreen();
                }, 1400);
            }, 400)
        })
    }
}

export function renderPreview(article, previewElement) {
    previewElement.innerText = getArticlePreview(article);
}

export function getArticlePreview(article) {
    if (article.subtitle) {
        return article.subtitle;
    }

    else if (
        article.body?.[0]?.children?.[0]?.text
    ) {
        let str = article.body[0].children[0].text;
        let maxCharLength = 100;

        // Split by sentence but keep the first one
        let firstSentence = str.split(/(?<=[.!?])\s/)[0];

        let finalTarget = firstSentence.length > maxCharLength 
            ? firstSentence.substring(0, maxCharLength) + "..." 
            : firstSentence;

        return finalTarget
            .normalize("NFKD")
            // This updated regex removes non-printable control characters 
            // but keeps standard text, numbers, and common punctuation (including dashes)
            .replace(/[^\x20-\x7E\u2013\u2014]/g, "");
    }

    return "";
}