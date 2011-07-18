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
	this.userAgent = 'DataSiftNodeConsumer/0.1';
	
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
	
	//Last connect
	this.lastConnect = null;

	//Add a listener for processing closing
	process.on('exit', function () {
		self.disconnect();
	});
	
	//Connect timeout
	this.connectTimeout = null;
	
	//Error callback
	this.errorCallback = function(err, emitDisconnect) {
		if (emitDisconnect === undefined) {
			emitDisconnect = false;
		}
		self.emit('error', err);
		self.disconnect(emitDisconnect);
	}
	
	//Disconnection callback
	this.disconnectCallback = function() {
		//Handle disconnection
		self.disconnect(true);
	}
	
	//Data callback
	this.dataCallback = function(chunk) {
		//Split by line space and look for json start
		var data = chunk.toString('utf8').split("\n");
		data.forEach(function(key, i){
			if ( data[i].length >= 50 ) {
				try { self.receivedData(JSON.parse(data[i]));} catch (e) {}
			}
		});
	}
	
	//Response callback
	this.responseCallback = function(response) {		
		self.response = response;
		
		//Set the last successful connect
		self.lastConnect = new Date().getTime();
		
		//Clear the request timeout
		if (self.connectTimeout != null) {
			clearTimeout(self.connectTimeout);
		}

		//Emit a connected event
		self.emit('connect');

		//Disconnection
		response.connection.on('end', self.disconnectCallback);
		
		//When we receive data do something with it
		response.on('data', self.dataCallback);
	};
	
}
util.inherits(DataSift, events.EventEmitter);


/**
 * Open a connection to DataSift
 *
 * @return void
 */
DataSift.prototype.connect = function() {
	var self = this;
	
	//Connect if we are allowed
	if (this.lastConnect == null || this.lastConnect < new Date().getTime() - 1500) {
		
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
		this.request = client.request("GET", '/', headers);

		//Check for an error on connection
		client.on('error', function(){
			self.errorCallback(new Error('Error connecting to DataSift: Could not reach DataSift. Check your internet connection.'));
		});

		//Add a connection timeout
		this.connectTimeout = setTimeout(function() {
			if (self.request != null) {
				self.request.abort();
				self.errorCallback(new Error('Error connecting to DataSift: Timed out waiting for a response'));
				self.disconnect();
			}
			clearTimeout(self.connectTimeout);
			self.connectTimeout = null;
		}, 5000);

		//Check for an error
		this.request.on('error', this.errorCallback);

		//Add a listener for the response
		this.request.on('response', this.responseCallback);
		this.request.write("\n", 'utf8');
	
	} else {
		//Not allowed to reconnect so emit error
		this.errorCallback(new Error('You cannot reconnect too soon after a disconnection'), true);
	}
	
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
	
	//Remove listeners
	if (this.request != null) {
		this.request.removeListener('error', this.errorCallback);
		this.request.removeListener('response', this.responseCallback);
	}
	if (this.response != null) {
		this.response.connection.removeListener('end', this.disconnectCallback);
		this.response.removeListener('data', this.dataCallback);
	}
	
	//Clear the request and response objects
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
		if (this.request != null) {
			this.request.write(JSON.stringify(json), 'utf8');
		} else {
			this.errorCallback(new Error('You cannot subscribe without being connected to DataSift'));
		}
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
		if (this.request != null) {
			this.request.write(JSON.stringify(json), 'utf8');
		} else {
			this.errorCallback('error', new Error('You cannot subscribe without being connected to DataSift'));
		}
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
		this.errorCallback(new Error(json.message));
		this.disconnect(true);
	
	} else if (json.status == "warning") {
		this.emit('warning', json.message);
	
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