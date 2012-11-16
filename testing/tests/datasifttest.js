
/**
 * User: wadeforman
 * Date: 11/6/12
 * Time: 10:47 AM
 */

"use strict"
var http = require('http');
var Q = require ('q');
var DataSift = require('../../datasift');

exports['create'] = {
    'success' : function(test) {
        var ds = DataSift.create('login','apiKey');

        test.equal(ds.login, 'login');
        test.equal(ds.apiKey, 'apiKey');
        test.done();
    },

    'login is a required param' : function(test) {
        test.throws(
            function(){
                DataSift.create();
            }, Error
        );
        test.done();
    },

    'apiKey is a required param' : function(test) {
        test.throws(
            function(){
                DataSift.create('login');
            }, Error
        );
        test.done();
    }
}

exports['subscribe'] = {
    'success' : function(test) {
        var ds = DataSift.create('login','apiKey');

        test.expect(3);
        ds._start = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds._subscribeToStream = function(hash){
            test.equal(hash, 'abc123');
            return Q.resolve();
        };

        ds.subscribe('abc123').then(
            function() {
                test.equal(ds.streams.get('abc123'), null);
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();
    },

    'will reject if client fails to connect' : function(test){
        var ds = DataSift.create('login','apiKey');
        test.expect(2);
        ds._start = function() {
            test.ok(true);
            return Q.reject();
        };

        ds.subscribe('abc123').then(
            function() {
                test.ok(false);
                test.done();
            }, function(err) {
                test.ok(true);
                test.done();
            }
        ).done();
    },

    'will reject if subscribe fails' : function(test) {
        var ds = DataSift.create('login','apiKey');
        test.expect(4);
        ds._start = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds.shutdown = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds._subscribeToStream = function(hash) {
            test.ok(true);
            return Q.reject('failed to sub');
        };

        ds.subscribe().then(
            function() {
                test.ok(false);
                test.done();
            }, function(err) {
                test.ok(true);
                test.done();
            }
        ).done();
    }
}

exports['subscribeToStream'] = {
    setUp: function (cb) {
        DataSift.SUBSCRIBE_WAIT = 50;
        cb();
    },

    tearDown : function (cb) {
        DataSift.SUBSCRIBE_WAIT = 50;
        cb();
    },

    'will subscribe to a stream' : function (test) {
        var ds = DataSift.create('testuser', 'apyKey');

        ds.client = {};
        ds.client.write = function (body, encoding){
            test.equal(body,'{"action":"subscribe","hash":"abc123"}' );

        };

        ds._subscribeToStream('abc123').then(
            function(){
                test.ok(!ds.pendingSubscribes.hasOwnProperty('abc123'));
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();

    },

    'will reject a warning with invalid credentials is emitted' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');

        ds.client = {};

        ds.client.write = function (body, encoding){
            test.equal(body,'{"action":"subscribe","hash":"abc123"}' );
        };

        ds._subscribeToStream('abc123').then(
            function(){
                test.ok(false);
                test.done();
            }, function(err){
                test.equal(err,'improperly formatted stream hash');
                test.done();
            }
        )
        ds.emit('warning', 'You did not send a valid hash to subscribe to');
    },

    'will reject on non-existent stream' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');

        ds.client = {};

        ds.client.write = function (body, encoding){
            test.equal(body,'{"action":"subscribe","hash":"abc123"}' );
        };

        ds._subscribeToStream('abc123').then(
            function(){
                test.ok(false);
                test.done();
            }, function(err){
                test.ok(!ds.pendingSubscribes.hasOwnProperty('abc123'));
                test.equal(err,"The hash abc123 doesn't exist");
                test.done();
            }
        )
        ds.emit('warning', "The hash abc123 doesn't exist");
    },

    'will return existing promise if attempting to subscribe already pending' : function(test) {
        var ds = DataSift.create('testuser', 'apyKey');
        var mockedPromise = {};
        ds.pendingSubscribes['abc123'] = {promise : mockedPromise};
        test.equal(mockedPromise, ds._subscribeToStream('abc123'));
        test.done();
    },

    'will not subscribe to warning twice' : function(test) {
        test.done();
    }
}

exports['start'] = {
    'success' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');
        test.expect(2);
        ds.client.start = function(){
            test.ok(true);
            return Q.resolve();
        };

        ds._start().then(
            function() {
                test.ok(true);
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();
    },

    'will call onData when a data event is emitted by the client' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');
        ds.client.start = function() {
            return Q.resolve();
        };

        ds._onData = function(data, statusCode) {
            test.equal(data, 'my data');
            test.equal(statusCode, 200);
            test.done();
        };

        ds._start();
        ds.client.emit('data', 'my data', 200);
    },

    'will call onEnd when an end event is emitted by the client' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');
        ds.client.start = function() {
            return Q.resolve();
        };

        ds._onEnd = function(statusCode) {
            test.equal(statusCode, 401);
            test.done();
        };

        ds._start();
        ds.client.emit('end', 401);
    },

    'will call resubscribe when a recovered event is emitted by the client' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');
        ds.client.start = function() {
            return Q.resolve();
        };

        ds._resubscribe = function() {
            test.ok(true);
            test.done();
        };

        ds._start();
        ds.client.emit('recovered');
    }
}

exports['resubscribe'] = {
    'success' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');

        ds.streams.set('123', null);
        ds.streams.set('456', null);
        ds.streams.set('abc', null);

        ds._subscribeToStream = function(hash) {
            test.ok(true);
            return Q.resolve();
        };
        test.expect(3);
        ds._resubscribe();
        test.done();
    },

    'will handle subscribe rejects' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');

        ds.streams.set('123', null);
        ds.streams.set('456', null);
        ds.streams.set('abc', null);

        ds._subscribeToStream = function(hash) {
            test.ok(true);
            return Q.reject();
        };

        test.expect(3);
        ds._resubscribe();
        test.done();
    }
}

exports['handleEvent'] = {

    setUp : function(cb){
        this.ds = DataSift.create('testuser', 'apiKey');
        DataSift.INTERACTION_TIMEOUT = 30;
        cb();
    },
    tearDown : function(cb){
        clearTimeout(this.ds.interactionTimeout);
        DataSift.INTERACTION_TIMEOUT = 300000;
        cb();
    },
    'success' : function (test) {
        //var ds = DataSift.create('testuser','apiKey');
        var interactionData = {'test' : 'abc', 'name' : 'jon', 'number' : 1};
        var eventData = { 'hash': '123' , 'data' : {'interaction': interactionData}};
        test.expect(1);
        this.ds.on('interaction', function (eventReceived) {
            test.deepEqual(eventReceived, eventData);
            test.done();
        });

        this.ds._handleEvent(eventData);
    },

    'will emit error if the status is error' : function (test) {
        var ds = DataSift.create('testuser','apiKey');
        var eventData = {};

        test.expect(2);

        ds.client.recover = function() {
            test.ok(true);
        };

        eventData.status = 'failure';

        ds.on('error', function (err) {
            test.ok(true);
        });
        ds._handleEvent(eventData);
        test.done();
    },

    'will emit warning if data json status is a warning' : function (test) {
        var ds = DataSift.create('testuser','apiKey');
        var eventData = {};
        eventData.status = 'warning';
        test.expect(1);
        ds.on('warning', function (err) {
            test.ok(true);
            test.done();
        });
        ds._handleEvent(eventData);

    },

    'will emit delete if data is defined but delete flag is set' : function (test) {
        var ds = DataSift.create('testuser','apiKey');
        var eventData = {};
        var data = {};
        data.data = 'data'
        data.deleted = true;
        eventData.data = data;

        test.expect(1);
        ds.on('delete', function (err) {
            test.ok(true);
            test.done();
        });
        ds._handleEvent(eventData);
    },

    'will emit tick if json has a tick property' : function (test) {
        var ds = DataSift.create('testuser','apiKey');
        var eventData = {};
        eventData.tick = true;

        test.expect(1);
        ds.on('tick', function () {
            test.ok(true);
            test.done();
        });
        ds._handleEvent(eventData);
    },

    'will emit unknownEvent on unrecognized events' : function (test) {

        var url = 'http://datasifter.com/'
        var ds = DataSift.create('testuser','apiKey');
        var eventData = {unknown : 123};
        test.expect(1);
        ds.on('unknownEvent', function (jsonReceived) {
            test.deepEqual(jsonReceived, eventData);
            test.done();
        });

        ds._handleEvent(eventData);
    },


    'will clean up connection on disconnect from DataSift' : function (test) {
        var ds = DataSift.create('testuser','apiKey');
        var eventData = {};
        ds.request = {};
        test.expect(1);

        eventData.status = 'failure';
        eventData.message = 'A stop message was received. You will now be disconnected';

        ds._handleEvent(eventData);
        test.equal(ds.client, undefined);
        test.done();
    },

    'will call recycle if no interactions are processed over a long period of time' : function(test){
        //var ds = DataSift.create('testuser','apiKey');

        var interactionData = {'test' : 'abc', 'name' : 'jon', 'number' : 1};
        var eventData = { 'hash': '123' , 'data' : {'interaction': interactionData}};
        var self = this;

        test.expect(2);
        this.ds.on('interaction', function(data) {
            test.ok(true);
        });

        this.ds._recycle = function(){
            test.notEqual(self.ds.client, undefined);
            test.done();
        };

        this.ds._handleEvent(eventData);
    }
}

exports['shutdown'] = {
    'success' : function(test) {
        var ds = DataSift.create('testuser','apiKey');

        ds.client = {};
        ds.client.write = function(contents) {
            test.equal(contents, JSON.stringify({action: 'stop'}));
        };

        ds.client.stop = function() {
            test.ok(true);
            return Q.resolve();
        };

        test.expect(3);
        ds.shutdown().then(
            function(){
                test.ok(true);
                test.done();
            },function(err){
                test.ok(false);
                test.done();
            }
        ).done();
    }
}

exports['unsubscribe'] = {
    'success' : function(test) {
        var ds = DataSift.create('testuser','apiKey');

        ds.client = {};
        ds.client.write = function(contents) {
            test.equal(contents, JSON.stringify({'action' : 'unsubscribe', 'hash' : 'abc123'}));
        };
        ds.streams.set('abc123', 'test123');
        ds.unsubscribe('abc123').then(
            function() {
                test.equal(ds.streams.length, 0);
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();
    }
}
exports['onData'] = {
    'success' : function (test) {
        var ds = DataSift.create('a','b','c','d');
        var testData = [];
        ds._handleEvent = function (data) {
            testData.push(data);
        };
        var expectedData = [{a:1}, {b:2},{c:3}];
        var chunk = '{"a" : 1}\n{"b" : 2}\n{"c":3}\n{"c":\n{"d":';
        ds._onData(chunk);
        test.deepEqual(testData,expectedData);
        test.equal(ds.responseData, '{"d":');
        test.done();
    },

    'will handle incorrectly formatted JSON objects' : function(test) {

        var ds = DataSift.create('a','b','c','d');
        var testData = [];

        ds._handleEvent = function (data) {
            testData.push(data);
        };

        var chunk = '{"a" : 1}\n{"b"\n{"c":3}\n{"c":\n{"d":';
        var expectedData = [{a:1}, {c:3}];
        ds._onData(chunk);
        test.deepEqual(testData,expectedData);
        test.equal(ds.responseData, '{"d":');
        test.done();

    },

    'will put partial data chunks together' : function(test) {
        var ds = DataSift.create('a','b','c','d');
        var testData = [];

        ds._handleEvent = function (data) {
            testData.push(data);
        };

        ds.on('warning', function(message) {
            test.ok(false);
        });
        var expectedData = [{a:1}];
        var chunk = '{"a" : ';
        ds._onData(chunk);
        chunk = '1}';
        ds._onData(chunk);
        chunk = '\n{ d';
        ds._onData(chunk);
        test.deepEqual(testData, expectedData);
        test.equal(ds.responseData, '{ d');
        test.done();

    }
}

exports['onEnd'] = {
    'success' : function(test) {
        var ds = DataSift.create('a','b','c','d');
        ds.responseData = 'i have stuff';

        ds._onEnd();
        test.equal(ds.responseData, '');
        test.done();
    }
}

exports['recycle'] = {
    'success' : function(test) {
        var ds = DataSift.create('test', 'api');

        ds.client = {};
        ds.client.stop = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds.client.recover = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds._resubscribe = function() {
            test.ok(true);
        };

        test.expect(4);
        ds._recycle().then(
            function() {
                test.ok(true);
                test.done();
            }, function(err) {
                console.log(err);
                test.ok(false);
                test.done();
            }
        ).done();
    },

    'will emit error on failed connection recycle' : function(test) {
            var ds = DataSift.create('test', 'api');

            ds.client = {};
            ds.client.stop = function() {
                test.ok(true);
                return Q.reject();
            };

            ds.on('error', function(error){
                test.ok(true);
            });

            test.expect(3);
            ds._recycle().then(
                function() {
                    test.ok(false);
                    test.done();
                }, function(err) {
                    test.ok(true);
                    test.done();
                }
            ).done();
    }
}
