import { createClient } from "https://esm.sh/@sanity/client";
import { toHTML } from "https://esm.sh/@portabletext/to-html";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});

function loadArticles() {
    const articles = client.fetch(`*[_type == "article"]`);

    articles.then(res => {
        for (let i = 0; i < res.length; i++) {
            let article = res[i];
            
            let title = article.title
            let link = `/articles/${article.linkName.current}`

            let e = document.createElement('a');
            e.target = '_self';
            e.href = link;
            e.innerText = title;

            document.body.appendChild(e);
        }
    });
}

loadArticles();