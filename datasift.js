/**
 * User: wadeforman
 * Date: 11/6/12
 * Time: 11:01 AM
 */

"use strict"

var Persistent = require('tenacious-http');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');

var __ = function() {
    EventEmitter.call(this);
};

__.SUBSCRIBE_WAIT = 750;
__.INTERACTION_TIMEOUT = 300000;

/**
 * creates an instance of the datasift driver
 * @param login
 * @param apiKey
 * @return {Object datasiftdriver}
 */
__.create = function(login, apiKey){
    var instance = new __();
    if(login) {
        instance.login = login;
    } else {
        throw new Error('login is a required param');
    }

    if(apiKey) {
        instance.apiKey = apiKey;
    } else {
        throw new Error('apiKey is a required param');
    }

    var header = {
        'User-Agent'        : 'DataSiftNodeConsumer/0.2.1',
        'Host'              : 'http://stream.datasift.com/',
        'Connection'        : 'Keep-Alive',
        'Transfer-Encoding' : 'chunked',
        'Authorization'     : login + ':' + apiKey
    };
    var init = function() {
        this.client.write('\n');
    };
    instance.subscribeListener = false;
    instance.attachedSubscribeWarningListener = false;
    instance.client = Persistent.create('http://stream.datasift.com/', 80, header,init.bind(instance));
    instance.responseData = '';
    instance.attachedListeners = false;
    instance.streams = {};
    return instance;
};

__.prototype = Object.create(EventEmitter.prototype);

/**
 * subscribes to multiple streams.
 * @param hashes - stream hashes provided by datasift.  either a string of single hash or an object keyed on the datasift hash
 * @return {array of promises}
 */
__.prototype.subscribe = function(hashes) {
    var self = this;

    if(!hashes){
        return Q.reject('hashes is a required paramater');
    }

    if(typeof hashes === 'string') {
        var h = hashes;
        hashes = {};
        hashes[h] = {};
    }

    var streamsToSubscribe = this._hashDifference(hashes, this.streams);
    var streamsToUnsubscribe = this._hashDifference(this.streams, hashes);
    var promises = [];

    Object.keys(streamsToUnsubscribe).forEach(
        function(hash){
            self.unsubscribe(hash);
        }
    );

    Object.keys(streamsToSubscribe).forEach(
        function(hash) {
            if(!self._validateHash(hash)) {
                promises.push(Q.reject('invalid hash'));
                return;
            }

            promises.push(self._start().then(
                function() {
                    return self._subscribeToStream(hash, streamsToSubscribe[hash]);
                }
            ).fail(
                function(err){
                    //only shutdown if there are no pending subscribes AND there are no active streams
                    if(Object.keys(self.streams).length === 0) {
                        self.shutdown();
                    }
                    return Q.reject(err);
                }
            ));
        }
    );

    return Q.allResolved(promises);
};

/**
 * unsubscribes to a already subscribed stream
 * @param hash
 * @return {promise}
 */
__.prototype.unsubscribe = function(hash) {
    var body = JSON.stringify({'action' : 'unsubscribe', 'hash' : hash});
    this.client.write(body, 'utf-8');
    delete this.streams[hash];
    return Q.resolve();
};

/**
 * attempts to subscribe to a specific stream hash
 * @param hash
 * @return {promise} - return a stream state object
 * @private
 */
__.prototype._subscribeToStream = function(hash, value) {
    var d = Q.defer();
    var subscribeMessage = JSON.stringify({'action' : 'subscribe', 'hash' : hash});
    var self = this;

    //only add listener if it has not been connected
    if(!this.attachedSubscribeWarningListener) {
        this.on('warning', function(message) {
            if(!message.indexOf("The hash",-1)) {
                var streamHash = message.split(' ')[2];
                if(self.streams.hasOwnProperty(streamHash)) {
                    self.streams[streamHash].deferred.reject(message);
                    delete self.streams[streamHash];
                }
            }
        });
        this.attachedSubscribeWarningListener = true;
    }

    if(this.streams.hasOwnProperty(hash)) { //already waiting or subscribed
        return this.streams[hash].deferred.promise;
    }

    if(value === undefined) {
        value = {};
    }
    this.streams[hash] = value;
    this.streams[hash].deferred = d;
    this.streams[hash].state = 'pending';
    this.streams[hash].hash = hash;

    this.client.write(subscribeMessage,'utf-8');

    Q.delay(__.SUBSCRIBE_WAIT).then(
        function() {
            self.streams[hash].state = 'subscribed';
            //d.resolve(hash);
            d.resolve(self.streams[hash]);
        });

    return this.streams[hash].deferred.promise;
};

/**
 * starts the connect
 * @return {promise}
 * @private
 */
__.prototype._start = function() {
    var self = this;
    if(!this.attachedListeners){
        this.client.on('data', function(chunk, statusCode) {
            self._onData(chunk, statusCode);
        });

        this.client.on('end', function(statusCode){
            self.emit('debug','end event received with status code ' + statusCode);
            self._onEnd(statusCode);
        });

        this.client.on('recovered', function(reason) {
            self.emit('debug', 'recovered from ' + reason);
            if(reason !== 'server end') {//skip server ends because we do not want to double subscribe.
                self._resubscribe();
            }
        });
        this.attachedListeners = true;
    }

    return this.client.start();
};

/**
 * sends subscribe messages to datasift based on streams already subscribed to by this instance
 * @private
 */
__.prototype._resubscribe = function(){
    var self = this;
    Object.keys(this.streams).forEach(function(key){ //key = datasift hash
        delete self.streams[key];
        self._subscribeToStream(key).then(
            function(){
                self.emit('debug', 'reconnected to stream hash ' + key);
            }, function(err) {
                self.emit('debug', 'failed to reconnect to stream hash ' + key + " with error: " + err);
            }
        );
    });
};

/**
 * shuts down the existing datasift stream
 * @return {promise}
 */
__.prototype.shutdown = function () {
    this.attachedListeners = false;
    this.attachedSubscribeWarningListener = false;
    this.streams = {};
    this.client.write(JSON.stringify({'action' : 'stop'}));
    return this.client.stop();
};

/**
 * onData callback which handles the data stream coming from the datasift streams.
 * @param chunk
 * @param statusCode
 * @private
 */
__.prototype._onData = function(chunk, statusCode) {
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
                    this.emit('warning', 'could not parse into JSON: ' + data[i] + ' with error: ' + e.toString());  //more details
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
 * on end call back
 * @param statusCode
 * @private
 */
__.prototype._onEnd = function(statusCode) {
    //underlying connection is "recovering"
    this.responseData = '';
};

/**
 * processes the data events coming from DataSift
 * @param eventData
 * @private
 */
__.prototype._handleEvent = function (eventData) {
    var self = this;
    if (eventData.status === 'failure') {
        if(eventData.message !== 'A stop message was received. You will now be disconnected') {
            this.emit('error', new Error(eventData.message));
            this.client.recover().then(
                function() {
                    self._resubscribe();
                }
            );
        } else { //means shutdown was called.
            this.client = undefined;
        }
    } else if (eventData.status === 'success' || eventData.status === 'warning' ) {
        this.emit(eventData.status,eventData.message, eventData);
    } else if (eventData.data !== undefined && eventData.data.deleted === true){
        this.emit('delete', eventData);
    } else if (eventData.tick !== undefined) {
        this.emit('tick', eventData);
    } else if (eventData.data !== undefined && eventData.data.interaction !== undefined) {
        clearTimeout(this.interactionTimeout);
        this.interactionTimeout = setTimeout(function(){
            self._recycle();
        }, __.INTERACTION_TIMEOUT);
        this.emit('interaction', eventData);
    } else {
        this.emit('unknownEvent', eventData);
    }
};

/**
 * recycles the connection.  used when the driver is in an unrecoverable state.  a new underlying socket will be assigned.
 * @return {promise}
 * @private
 */
__.prototype._recycle = function(){
    var self = this;
    this.emit('debug', 'recycling connection');

    return this.client.stop().then(
        function() {
            return self.client.recover();
    }).then(
        function() {
            return self._resubscribe();
        }
    ).fail(
        function(err) {
            self.emit('error', 'failed to reconnect: ' + err);
            return Q.reject(err);
        }
    );
};

/**
 * validates the format of the hash
 * required to be a 32 character hex string
 * @param hash
 * @return {Boolean}
 * @private
 */
__.prototype._validateHash = function (hash) {
    return /^[a-f0-9]{32}$/i.test(hash);
};

/**
 * takes the difference between two hashes {hash1} - {hash2} = {resulting set}
 * @param hash1
 * @param hash2
 * @return {Object}
 * @private
 */
__.prototype._hashDifference = function(hash1, hash2) {
    hash1 = hash1 || {};
    hash2 = hash2 || {};

    var difference = {};
    Object.keys(hash1).forEach( function(key) {
        if(!hash2.hasOwnProperty(key)) {
            difference[key] = hash1[key];
        }
    });
    return difference;
};

module.exports = __;