var http = require('http');
var util = require('util');
var events = require('events');

/** 
 * Creates DataSift instance
 *
 * @param string   username
 * @param string   API key
 * 
 * @return void
 */
function DataSift(username, apiKey, host, port) {
	events.EventEmitter.call(this);
	var self = this;
	
	//The username
	this.username = username;

	//The API key
	this.apiKey = apiKey;

	//The user agent
	this.userAgent = 'DataSiftNodeConsumer/1.0';
	
	//The host
	if (host !== undefined) {
		this.host = host;
	} else {
		this.host = 'stream.datasift.net';
	}
	
	//The port
	if (port !== undefined) {
		this.port = port;
	} else {
		this.port = 80;
	}
	
	//The request object
	this.request = null;
	
	//The response object
	this.response = null;
	
	//Go ahead and connect to DataSift
	this.connect();

	//Add a listener for processing closing
	process.on('exit', function () {
		self.disconnect();
	});
	
}
util.inherits(DataSift, events.EventEmitter);


/**
 * Open a connection to DataSift
 *
 * @return void
 */
DataSift.prototype.connect = function() {
	var self = this;
	
	//Create the headers
	var headers = {
		'User-Agent'        : this.userAgent,
		'Host'              : this.host,
		'Connection'        : 'Keep-Alive',
		'Transfer-Encoding' : 'chunked',
		'Authorization'     : this.username + ':' + this.apiKey
	};

	//Create an http client
	var client = http.createClient(this.port, this.host);

	//Make the request
	self.request = client.request("GET", '/', headers);

	//Add a connection timeout
	var connectTimeout = setTimeout(function() {
		self.request.abort();
		self.emit('error', new Error('Error connecting to DataSift: Timed out waiting for a response'));
	}, 10000);

	//Check for an error
	self.request.on('error', function(err) {
		self.emit('error', new Error('Error connecting to DataSift: ' + e.message));
	});

	//Add a listener for the response
	self.request.on('response', function(response) {		
		self.response = response;
		
		//Clear the request timeout
		clearTimeout(connectTimeout);
		
		//Emit a connected event
		self.emit('connect');

		//Disconnection
		self.response.connection.on('end', function(a) {
			//Handle disconnection
			self.disconnect(true);
		});

		//When we receive data do something with it
		self.response.on('data', function(chunk) {
			//Split by line space and look for json start
			var data = chunk.toString('utf8').split("\n");
			for(var i=0; i<data.length; i++ ) {
				if ( data[i].length >= 50 ) {
					try { self.receivedData(JSON.parse(data[i]));} catch (e) {}
				}
			}
		});
	});
	self.request.write("\n", 'utf8');
};


/**
 * Disconnected from DataSift
 *
 * @param boolean forced if the disconnection was forced or not
 * 
 * @return void
 */
DataSift.prototype.disconnect = function(forced) {
	if (forced) {
		//Reset request and response
		this.emit('disconnect');
	}
	
	this.request = null;
	this.response = null;
};


/**
 * Subscribe to a hash
 *
 * @param string hash the stream hash
 * 
 * @return void
 */
DataSift.prototype.subscribe = function(hash) {
	
	//Check the hash
	if (!this.checkHash(hash)) {
		//Send error
		this.emit('error', new Error('Invalid hash given: ' + hash));
	} else {
		//Send json message to DataSift to subscribe
		var json = {"action":"subscribe", "hash":hash};
		this.request.write(JSON.stringify(json), 'utf8');
	}
};


/**
 * Unsubscribe from a hash
 *
 * @param string hash the stream hash
 * 
 * @return void
 */
DataSift.prototype.unsubscribe = function(hash) {
	
	//Check the hash
	if (!this.checkHash(hash)) {
		//Send error
		this.emit('error', new Error('Invalid hash given: ' + hash));
	} else {
		//Send json message to DataSift to subscribe
		var json = {"action":"unsubscribe", "hash":hash};
		this.request.write(JSON.stringify(json), 'utf8');
	}
};


/**
 * Process received data
 *
 * @param Object the json object
 * 
 * @return void
 */
DataSift.prototype.receivedData = function(json) {
	//Check to see if its an error
	if (json.status == "failure") {
		this.emit('error', new Error(json.message));
		this.disconnect(true);
	} else {
		this.emit('interaction', json);
	}
	
};


/**
 * Subscribe to a hash
 *
 * @param string hash the stream hash
 * 
 * @return void
 */
DataSift.prototype.checkHash = function(hash) {
	try {hash = /([a-f0-9]{32})/i.exec(hash)[1];} catch(e) {}
	if (hash == null) {
		return false;
	} else {
		return true;
	}
};

//Add exports
module.exports = DataSift;