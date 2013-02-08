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
	this.userAgent = 'DataSiftNodeConsumer/0.2.1';
	
	//The host
	if (host !== undefined) {
		this.host = host;
	} else {
		this.host = 'stream.datasift.com';
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
	
	//Data
	this.data = '';

	//Add a listener for processing closing
	process.on('exit', function () {
		self.disconnect();
	});
	
	//Connect timeout
	this.connectTimeout = null;

	//Data received timeout
	this.dataTimeout = null;
	
	//Convert the next error to a success
	this.convertNextError = false;
	
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

		// We have data to send, so let's reset the timer
		self.resetDataReceivedTimer();
		
		//Convert to utf8 from buffer
		chunk = chunk.toString('utf8');
		
		//Add chunk to data
		self.data += chunk;
		
		//If the string contains a line break we will have JSON to process
		if (chunk.indexOf("\n") > 0) {
			//Split by line space and look for json start
			var data = self.data.split("\n");
			if (data[0] !== undefined) {
				var json = null;
				try {json = JSON.parse(data[0])} catch (e) {}
				if (json != null) {
					self.receivedData(json);
				}
			}
			
			//Add the second half of the chunk to a new piece of data
			self.data = data[1];
			
		}
		
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

		//Set our data receiving timer going
		self.resetDataReceivedTimer();

		//Disconnection
		response.connection.on('end', self.disconnectCallback);
		
		//When we receive data do something with it
		response.on('data', self.dataCallback);
	};
	
}
util.inherits(DataSift, events.EventEmitter);


/**
 * Reset the data received timer
 *
 * @return void
 */
DataSift.prototype.resetDataReceivedTimer = function() {

	var disconnectTimeout = 65000;

	if (this.dataTimeout != null) {
		clearTimeout(this.dataTimeout);
	}

	this.dataTimeout = setTimeout(function(){
		this.disconnect(true);
	}.bind(this), disconnectTimeout);
}


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
		this.request = http.request({
			port: this.port,
			host: this.host,
			headers: headers,
			method: 'GET',
			path: '/'
		});

		//Check for an error on connection
 		this.request.on('error', function(){
      			self.errorCallback(new Error('Error connecting to DataSift: Could not reach DataSift. Check your internet connection.'));
 		});

		//Add a connection timeout
		this.connectTimeout = setTimeout(function() {
			if (self.request != null) {
				self.request.abort();
				self.errorCallback(new Error('Error connecting to DataSift: Timed out waiting for a response'));
				self.disconnect(true);
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
	if (forced && this.request !== null) {
		//Reset request and response
		this.emit('disconnect');
		
		//Remove listeners
		this.request.removeListener('error', this.errorCallback);
		this.request.removeListener('response', this.responseCallback);
		if (this.response != null) {
			this.response.connection.removeListener('end', this.disconnectCallback);
			this.response.removeListener('data', this.dataCallback);
		}

		//Try and actually close the connection
		try {
			this.response.destroy();
		} catch (e){}

		//Clear the request and response objects
		this.request = null;
		this.response = null;
		
	} else if (this.request !== null) {
		//Send the stop message and convert the error response
		this.convertNextError = true;
		this.send(JSON.stringify({"action":"stop"}));
	}
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
		this.send(JSON.stringify({"action":"subscribe", "hash":hash}));
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
		//Send json message to DataSift to unsubscribe
		this.send(JSON.stringify({"action":"unsubscribe", "hash":hash}));
	}
};


/**
 * Send data to DataSift
 *
 * @param string message the message
 * 
 * @return void
 */
DataSift.prototype.send = function(message) {
	if (this.request != null) {
		this.request.write(message, 'utf8');
	} else {
		this.emit('error', new Error('You cannot send actions without being connected to DataSift'));
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
	//Check for errors
	if (json.status == "failure") {
		if (this.convertNextError) {
			this.emit('success', json.message);
			this.convertNextError = false;
		} else {
			this.errorCallback(new Error(json.message));
			this.disconnect(true);
		}
	
	//Check for warnings
	} else if (json.status == "warning") {
		this.emit('warning', json.message, json);
	
	//Check for successes
	} else if (json.status == "success") {
		this.emit('success', json.message, json);
	
	//Check for deletes
	} else if (json.data !== undefined && json.data.deleted === true) {
		this.emit('delete', json);
	
	//Check for ticks
	} else if (json.tick !== undefined) {
		this.emit('tick', json);
		
	//Normal interaction
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
