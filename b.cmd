
node build/generate-articles.js
node build/generate-sitemap.js

git add .
git commit -m %1
git remote add origin https://github.com/great-anaphylaxis/the-maroon-ink.git
git remote -v
git push -f origin master

REM Github actions already exists
REM firebase deploy --only hosting:jhareign