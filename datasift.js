/**
 * driver which connects to a datasift stream and emits data from datasift
 * User: wadeforman
 * Date: 8/31/12
 * Time: 1:52 PM
 */

"use strict"

var http = require('http');
var Q = require('q');
var parseUrl = require('url').parse;
var EventEmitter = require('events').EventEmitter;

/**
 * private constructor
 * @private
 */
var __ = function () {
};

__.prototype = new EventEmitter();
__.SOCKET_TIMEOUT = 60000;
/**
 * factory method for creating a DataSift instance
 *
 * @param username - datasift username (required)
 * @param apiKey - apikey provided by datasift (required)
 * @param host - host to connect to (defaults to 'http://stream.datasift.com/)
 * @param port - port to connect to (defaults to 80)
 */
__.create = function (username, apiKey, host, port) {
    var instance = new __();

    if (username === undefined) {
        throw new Error('username is a required parameter');
    }
    if (apiKey === undefined) {
        throw new Error('apiKey is a required parameter');
    }
    instance.username = username;
    instance.apiKey = apiKey;
    instance.host = host || 'http://stream.datasift.com/';
    instance.port = port || 80;
    instance.userAgent = 'DataSiftNodeConsumer/0.2.1';
    instance.connectionState = 'disconnected';
    instance.reconnectAttempts = 0;
    instance.responseData = '';
    return instance;
};

/**
 * starts listening to a datasift stream (as a hash).
 * attempts to reconnect to the datasift stream if the connection
 * fails and the autoReconnect flag is set
 * @param hash - hash for a specific stream
 * @return {promise}
 */
__.prototype.start = function (hash) {
    var self = this;
    self.hash = hash;

    if(self.connectionState !== 'disconnected') {
        return Q.resolve();
    }
    return this._establishConnection();
};

/**
 * unsubscribes and disconnects from the stream
 * attempts to reconnect to the stream if the autoReconnect flag is set.
 * @return {promise}
 */
__.prototype.stop = function () {
    this._transitionTo('disconnected');
    return Q.resolve();
};

/**
 * Connects to a DataSift stream
 * @return {promise}
 */
__.prototype._connect = function () {
    var self = this;
    var options;

    if(self.connectionState !== 'disconnected') {
        return Q.resolve();
    }

    Q.delay(self._calculateReconnectDelay());

    self.connectionState = 'connecting';
    var d = Q.defer();

    options =  parseUrl(this.host, true);
    options.port = this.port;
    options.method = 'GET';
    options.headers = {
        'User-Agent'        : this.userAgent,
        'Host'              : this.host,
        'Connection'        : 'Keep-Alive',
        'Transfer-Encoding' : 'chunked',
        'Authorization'     : this.username + ':' + this.apiKey
    };

    self.request = http.request(options, function(response) {
        response.setEncoding('utf-8');
        self.statusCode = response.statusCode;
        d.resolve(response);
    });

    self.request.on('socket', function (socket) {
        socket.setTimeout(__.SOCKET_TIMEOUT);

        socket.on('timeout', function() {
            socket.destroy();
            if(Q.isPromise(d.promise)) { //only call if the promise has already been resolved.
                self.emit('warning', 'socket time out.  reconnecting');
                self._transitionTo('connected');
            }
        });

        socket.on('close', function (hasError) {
            if(hasError) {
                socket.destroy();
            }
        });
    });

    self.request.on('error', function (e) {
        d.reject(e);
    });

    self.request.write('\n', 'utf-8');

    return d.promise;
};

/**
 * subscribes to the steam
 * @param hash
 */
__.prototype._subscribe = function () {
    if(this.connectionState === 'disconnected') {
        return;
    }
    var body = JSON.stringify({'action' : 'subscribe', 'hash' : this.hash});
    this.request.write(body, 'utf-8');
};

/**
 * unsubscribes to the stream
 * @private
 */
__.prototype._unsubscribe = function () {
    if(this.connectionState !== 'connected') {
        return;
    }
    var body = JSON.stringify({'action' : 'unsubscribe', 'hash' : this.hash});
    this.request.write(body, 'utf-8');
};

/**
 * disconnects form the DataSift
 * @private
 */
__.prototype._disconnect = function () {
    if(this.connectionState !== 'connected'){
        return;
    }
    var body = JSON.stringify({'action' : 'stop'});
    this.request.write(body, 'utf-8');
};

/**
 * processes the data events coming from DataSift
 * @param eventData
 * @private
 */
__.prototype._handleEvent = function (eventData) {

    if (eventData.status === 'failure') {
        if(eventData.message !== 'A stop message was received. You will now be disconnected') {
            this.emit('error', new Error(eventData.message));
            this._transitionTo('connected');
        } else { //means _disconnect was called
            this._transitionTo('disconnected');
        }
    } else if (eventData.status === 'success' || eventData.status === 'warning' ) {
        this.emit(eventData.status,eventData.message, eventData);
    } else if (eventData.data !== undefined && eventData.data.deleted === true){
        this.emit('delete', eventData);
    } else if (eventData.tick !== undefined) {
        this.emit('tick', eventData);
    } else if (eventData.data !== undefined && eventData.data.interaction !== undefined) {
        //self.emit('interaction', eventData.data.interaction);
        this.emit('interaction', eventData);
    } else {
        this.emit('unknownEvent', eventData);
    }
};

/**
 * calculates the required delay before attempting to connect to datasift (in ms)
 * @return {Number}
 * @private
 */
__.prototype._calculateReconnectDelay = function () {
    var delay = 0;

    if(this.reconnectAttempts == 0) {
        ++this.reconnectAttempts;
        return delay;
    }
    delay += 10000 * Math.pow(2, this.reconnectAttempts - 1);
    if(delay > 320000) {
        return 320000;
    }
    ++this.reconnectAttempts;
    return delay;
};

/**
 * transitions to the desired state
 * @param stateTo
 * @private
 */
__.prototype._transitionTo = function(stateTo) {
    this.emit('warning', 'transitioning from ' + this.connectionState + ' to ' + stateTo + '\n');
    switch(stateTo) {
        case 'disconnected':
            if(this.connectionState === 'connected') {
                this._unsubscribe();
                this._disconnect();
            } else if (this.connectionState === 'connecting') {
                this._disconnect();
            }
            this.request = null;
            this.connectionState = 'disconnected';
            break;
        case 'connected':
            if (this.connectionState === 'connecting') {
                this._subscribe();
                this.connectionState = 'connected';
                this.emit('connect');
                this.reconnectAttempts = 0;
            } else {
                this.connectionState = 'disconnected';
                this._transitionTo('connecting');
            }
            break;
        case 'connecting':
            if(this.connectionState === 'disconnected') {
                return this._establishConnection();
            } else {
                this.connectionState = 'disconnected';
                this._transitionTo('connecting');
            }
            break;
        case 'error':
            this.connectionState = 'disconnected';
            this._transitionTo('connecting');
        default:
            break;
    }
};

/**
 * processes data from the server
 * @param chunk
 * @private
 */
__.prototype._onData = function(chunk){
    this.responseData += chunk;
    if(chunk.indexOf('\n') >= 0) {
        var data = this.responseData.split('\n');
        this.responseData = data.pop();
        for (var i = 0; i < data.length; i++) {
            if (data[i] !== undefined) {
                var eventData;
                try {
                    eventData = JSON.parse(data[i]);
                } catch(e) {
                    this.emit('warning', 'could not parse into JSON: ' + data + ' with error: ' + e.toString());  //more details
                    continue;
                }
                if (eventData) {
                    this._handleEvent(eventData);
                }
            }
        }
    }
};

/**
 * handle an 'end' from the server
 * @private
 */
__.prototype._onEnd = function() {
    this.emit('warning', 'received end from server');
    if(this.statusCode !== 200) {
        this.emit('warning', 'connection ended with a bad status ' + this.statusCode +' code with the message: ' + this.responseData);
        if(this.statusCode === 401){
            this.emit('warning', 'invalid credentials');
            this._transitionTo('disconnected');
            return;
        }
    } else {
        try {
            var eventData = JSON.parse(this.responseData);
        } catch(e) {
            this.emit('warning', 'partial data remains: ' + this.responseData);
        }
        if (eventData) {
            this._handleEvent(eventData);
        }
    }
    this.responseData = '';
    this._transitionTo('connected');
};

/**
 * establishes a connection to the remote server
 * @return {promise}
 * @private
 */
__.prototype._establishConnection = function() {
    var self = this;
    this.responseData = '';
    return self._connect()
        .then(function(response) {
            self.connectionState = 'connecting';
            response.on('end', self._onEnd.bind(self));
            response.on('data', self._onData.bind(self));
        }).then( function(){
            self._transitionTo('connected');
        }, function(err) {
            self.connectionState = 'disconnected';
            self._transitionTo('connecting');
        });
};

module.exports = __;