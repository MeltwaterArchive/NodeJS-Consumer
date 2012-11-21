#! /bin/sh

which docco >/dev/null 2>&1 || { echo >&2 \
"This script requires additional software to run. If you run Ubuntu, please make sure that you install the following packages:\n" \
"\n" \
"sudo apt-get install nodejs\n" \
"sudo apt-get install npm\n" \
"sudo apt-get install python-setuptools\n" \
"sudo npm install -g docco\n" \
"sudo npm install -g coffee-script\n" \
"sudo easy_install Pygments\n" \
; exit 1; }

docco ../../master/*.js

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
