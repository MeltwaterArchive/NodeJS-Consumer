/**
 * User: wadeforman
 * Date: 11/6/12
 * Time: 11:01 AM
 */

"use strict"
var Persistent = require('tenaciousHttp');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');

var __ = function() {

};

__.SUBSCRIBE_WAIT = 750;

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
    instance.client = Persistent.create('http://stream.datasift.com/', 80, header,init.bind(instance));
    instance.responseData = '';
    instance.attachedListeners = false;
    return instance;
}

__.prototype = Object.create(EventEmitter.prototype);

/**
 * subscribes to multiple streams
 * @param hash - stream hash provided by datasift
 * @return {Promise}
 */
__.prototype.subscribe = function(hash) {
    var d = Q.defer();
    var self = this;

    this._start().then(
        function() {
            self._subscribeToStream(hash).then(
                function() {
                    d.resolve();
                }, function(err) {
                    self.shutdown().then(
                        function(){
                            d.reject(err);
                        }
                    );
                }
            );
        }, function(err) {
            d.reject(err);
        }
    );
    return d.promise;
};

/**
 * attempts to subscribe to a specific stream hash
 * @param hash
 * @return {Promise}
 * @private
 */
__.prototype._subscribeToStream = function(hash) {
    var d = Q.defer();
    var badSubscribe = false;
    var subscribeMessage = JSON.stringify({'action' : 'subscribe', 'hash' : hash});
    this.once('warning', function(message) {
        if(!message.indexOf('You did not send a valid hash to subscribe to',-1)){
            badSubscribe = true;
            this.statusCode =  404;
            d.reject('bad stream hash (' + hash + ').');
        }
    });
    this.client.write(subscribeMessage,'utf-8');

    Q.delay(__.SUBSCRIBE_WAIT).then(
        function() {
            d.resolve();
        });
    return d.promise;
};

/**
 * unsubscribes to a already subscribed stream
 * @param hash
 * @return {Promise}
 */
__.prototype.unsubscribe = function(hash) {
    var body = JSON.stringify({'action' : 'unsubscribe', 'hash' : hash});
    this.client.write(body, 'utf-8');
    return Q.resolve();  //todo fix this up
};

/**
 * starts the connect
 * @return {Promise}
 * @private
 */
__.prototype._start = function() {
    var self = this;
    if(!this.attachedListeners){
        this.client.on('data', function(chunk, statusCode) {
            self._onData(chunk, statusCode);
        });

        this.client.on('end', function(statusCode){
            self._onEnd(statusCode);
        });
        this.attachedListeners = true;
    }

    return this.client.start();
};

/**
 * shuts down the existing datasift stream
 * @return {Promise}
 */
__.prototype.shutdown = function () {
    this.attachedListeners = false;
    this.client.write(JSON.stringify({'action' : 'stop'}));
    return this.client.stop();
};

/**
 * onData callback which handles the data stream coming form datasift.
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
    //underlying driver is "recovering"
    this.responseData = '';
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
            this.client.recover();
        } else { //means _disconnect was called
            this.client = undefined;
        }
    } else if (eventData.status === 'success' || eventData.status === 'warning' ) {
        this.emit(eventData.status,eventData.message, eventData);
    } else if (eventData.data !== undefined && eventData.data.deleted === true){
        this.emit('delete', eventData);
    } else if (eventData.tick !== undefined) {
        this.emit('tick', eventData);
    } else if (eventData.data !== undefined && eventData.data.interaction !== undefined) {
        this.emit('interaction', eventData);
    } else {
        this.emit('unknownEvent', eventData);
    }
};

module.exports = __;