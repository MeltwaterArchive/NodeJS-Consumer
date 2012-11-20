# Generating documentation from sources

This document exists for the benefit of anyone who wants to generate a new
sets of docs for the GitHub pages for this project.

1.  Make sure that git is installed on your system:

    `git --version`

    If you are using Ubuntu, you can install it using this command:

    `sudo apt-get install git`

2. Create a temporary directory

    `mkdir tmp`

3. Change the current working directory

    `cd tmp`

4. Clone the datasift/NodeJS-Consumer into master directory

    `git clone https://github.com/datasift/NodeJS-Consumer master`

5. Clone the datasift/NodeJS-Consumer into gh-pages directory

    `git clone https://github.com/datasift/NodeJS-Consumer gh-pages`

6. Change the current working directory to gh-pages

    `cd gh-pages`

7. Switch to the gh-pages branch

    `git checkout gh-pages`

8. Change the working directory to doc-tools

    `cd doc-tools`

9. Run autodoc generator tools

    `sh ./make-docs.sh`

10. Change to the parent directory

    `cd ..`

11. Stage new documentation in git

    `git add *.html`

    `git add *.css`

12. Commit the new documentation

    `git commit -m "Include a meaningful description here."``

13. Push changes to github

    `git push origin gh-pages`

14. That's it! you can delete the temporary directory now.

    `cd ../..`

    `rm -rf tmp`
