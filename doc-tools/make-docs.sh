#!/bin/sh -v
if [ -z "$1" ]; then
    echo 'You must run this script with branch name as its argument, e.g.'
    echo 'sh ./make-docs.sh master'
    exit
fi
echo 'working on branch '$1
echo 'installing tools'
sudo apt-get install git
sudo apt-get install nodejs
sudo apt-get install npm
sudo apt-get install python-setuptools
sudo npm install -g docco
sudo npm install -g coffee-script
sudo easy_install Pygments
echo 'making temporary directory'
mkdir tmp
cd tmp
echo 'cloning repos'
git clone https://github.com/datasift/NodeJS-Consumer code
git clone https://github.com/datasift/NodeJS-Consumer gh-pages
cd code
git checkout $1
cd ..
cd gh-pages
git checkout gh-pages

cd doc-tools

docco ../../code/*.js

cd docs
fl=`ls *html`
cd ..

for f in $fl
do 
	echo '//<a href="'$f'">'$f'</a><br />' >> index-body.js;
done

echo '//<a href="https://github.com/datasift/NodeJS-Consumer/blob/master/LICENSE">LICENSE</a><br />' >> index-body.js
echo '//<a href="https://github.com/datasift/NodeJS-Consumer/blob/master/README.md">README.md</a><br />' >> index-body.js
echo ' ' >> index-body.js

cat index-header.js index-body.js index-footer.js > index.js
docco index.js
cat docs/index.html | sed -e 's/index.js/NodeJS-Consumer/g' > docs/index_new.html
mv docs/index_new.html docs/index.html

cp docs/* ../
rm -rf docs index.js index-body.js
cd ..

git add *.html
git add *.css
git commit -m 'Updated to reflect the latest changes to '$1
echo 'You are going to update the gh-pages branch to reflect the latest changes to '$1
git push origin gh-pages
echo 'finished'
