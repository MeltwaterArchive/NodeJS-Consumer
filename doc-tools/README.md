# Generating documentation from sources

This document exists for the benefit of anyone who wants to generate a new
sets of docs for the GitHub pages for this project.

1. Clone datasift/NodeJS-Consumer master branch

git clone https://github.com/datasift/NodeJS-Consumer
git checkout master

2. Checkout gh-pages

git checkout gh-pages

3. Change the working directory to doc-tools

cd doc-tools

4. Run autodoc generator tools

sh ./make-docs.sh

5. Change to the parent directory

cd ..

5. Commit the new documentation

git commit

That's it!
