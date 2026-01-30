import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyBlfueAMsSwf5yRli2rpQVoRwqjIO1WmMk",
    authDomain: "the-maroon-ink.firebaseapp.com",
    projectId: "the-maroon-ink",
    storageBucket: "the-maroon-ink.firebasestorage.app",
    messagingSenderId: "864149127700",
    appId: "1:864149127700:web:8f1384e4e4bfe012145d01",
    measurementId: "G-JEMNZVHFQE"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export function log(msg) {
    logEvent(analytics, msg);
}