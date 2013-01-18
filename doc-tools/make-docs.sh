#!/bin/bash
#-v

export BASE_DIR="`pwd`/"

source ${BASE_DIR}sub/make-docs-util-defs.sh
export BASE_DIR="/tmp/$(basename $0).$$.tmp/"
initialise $*

### node.js-specific parameters
parameters "nodejs" "NodeJS-Consumer"

### installation of node.js-specific tools
message "installing tools"
sudo apt-get install git
sudo apt-get install nodejs
sudo apt-get install npm
sudo apt-get install python-setuptools
sudo npm install -g docco
sudo npm install -g coffee-script
sudo easy_install Pygments

pre_build

### node.js-specific build steps

(
	message "building documents"
	cd ${GH_PAGES_DIR}doc-tools ; stop_on_error
	docco ../../code/*.js ; stop_on_error

	cd ${GH_PAGES_DIR}doc-tools/docs ; stop_on_error
	fl=`ls *html`
	cd ${GH_PAGES_DIR}doc-tools ; stop_on_error

	for f in ${fl}
	do 
		echo '//<a href="'${f}'">'${f}'</a><br />' >> index-body.js;
	done

	echo '//<a href="https://github.com/datasift/NodeJS-Consumer/blob/master/LICENSE">LICENSE</a><br />' >> index-body.js
	echo '//<a href="https://github.com/datasift/NodeJS-Consumer/blob/master/README.md">README.md</a><br />' >> index-body.js
	echo ' ' >> index-body.js

	cat index-header.js index-body.js index-footer.js > index.js
	docco index.js ; stop_on_error
	cat docs/index.html | sed -e 's/index.js/NodeJS-Consumer/g' > docs/index_new.html
	mv docs/index_new.html docs/index.html
) || error "stopped parent"
(
	message "copying documents"
	cd ${GH_PAGES_DIR}doc-tools ; stop_on_error
	cp docs/* ../ ; stop_on_error
	rm -rf docs index.js index-body.js ; stop_on_error
) || error "stopped parent"

(
	cd ${GH_PAGES_DIR} ; stop_on_error
	git add *.html
	git add *.css
) || error "stopped parent"

post_build

finalise
