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
    // const maxCharacterLength = 200;

    articles.then(res => {

        console.log(res)
        // for (let i = 0; i < res.length; i++) {
        //     let blog = res[i];
        //     let src = blog.image.asset._ref.replace('-png', '.png').replace('image-', ''); // ewwww
        //     let content = toHTML(blog.body);
        //     let contentElement = document.createElement('p');
        //     contentElement.innerHTML = content;
            
        //     let type = "blogs"
        //     let name = "custom"
        //     let title = blog.title
        //     let description = contentElement.textContent.substring(0, maxLength) + "..."; // ewwwwwwww
        //     let link = `/blogs/${blog.slug.current}`
        //     let target = "_self"
        //     let customImageSrc = `https://cdn.sanity.io/images/lydpa3ua/production/${src}`;
            
        //     loadProject(type, name, title, description, link, target, customImageSrc);
        // }
    });
}

loadArticles();