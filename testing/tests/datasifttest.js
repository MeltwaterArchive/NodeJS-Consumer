
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

        test.expect(4);
        ds._start = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds._subscribeToStream = function(hash){
            test.equal(hash, 'abc123');
            return Q.resolve(hash);
        };

        ds._validateHash = function(hash) {
            test.ok(true);
            return true;
        };

        ds.subscribe('abc123').then(
            function(h) {
                test.equal(h[0].valueOf(),'abc123');
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();
    },

    'will reject if client fails to connect' : function(test){
        var ds = DataSift.create('login','apiKey');
        test.expect(4);
        ds._start = function() {
            test.ok(true);
            return Q.reject();
        };

        ds._validateHash = function(hash) {
            test.ok(true);
            return true;
        };

        ds.shutdown = function() {
            test.ok(true);
            return Q.resolve();
        };
        ds.subscribe('abc123').then(
            function(p) {
                test.ok(!p[0].isFulfilled());
                test.done();
            }
        ).done();
    },

    'will reject if subscribe fails' : function(test) {
        var ds = DataSift.create('login','apiKey');
        test.expect(5);
        ds._start = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds._validateHash = function(hash) {
            test.ok(true);
            return true;
        };
        ds.shutdown = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds._subscribeToStream = function(hash) {
            test.ok(true);
            return Q.reject('failed to sub');
        };

        ds.subscribe('123').then(
            function(p) {
                test.ok(!p[0].isFulfilled());
                test.done();
            }
        ).done();
    },

    'will reject an invalid formatted hash' : function(test) {
        var ds = DataSift.create('login','apiKey');
        test.expect(2);

        ds._validateHash = function(hash) {
            test.ok(true);
            return false;
        };

        ds.subscribe('1').then(
            function(p) {
                test.ok(!p[0].isFulfilled());
                test.done();
            }
        ).done();
    },

    'will reject if hashes is not passed in a parameter' : function(test) {
        var ds = DataSift.create('login','apiKey');

        ds.subscribe().then(
            function() {
                test.ok(false);
                test.done();
            }, function(err) {
                test.ok(true);
                test.done();
            }
        )
    },

    'will unsubscribe if the subscribe object is has removed it' : function(test) {
        var ds = DataSift.create('login','apiKey');
        ds.streams['abc123'] = {};

        ds.unsubscribe = function(hash) {
            test.equal(hash, 'abc123');
            return Q.resolve();
        };

        test.expect(2);

        ds.subscribe({}).then(
            function() {
                test.ok(true);
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        )
    },

    'will handle an dictionary of hashes' : function(test) {
        var ds = DataSift.create('login','apiKey');

        test.expect(8);
        var hashes = {
            'key1' : undefined,
            'key2' : undefined
        }
        ds._start = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds._subscribeToStream = function(hash){
            test.ok(true);
            return Q.resolve(hash);
        };

        ds._validateHash = function(hash) {
            test.ok(true);
            return true;
        };

        ds.subscribe(hashes).then(
            function(h) {
                test.equal(h[0].valueOf(),'key1');
                test.equal(h[1].valueOf(),'key2');
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();
    },

    'will handle a dictionary of hashes with both valid and invalid hashes' : function(test) {
        var ds = DataSift.create('login','apiKey');

        test.expect(14);
        var hashes = {
            'key1' : undefined,
            'key2' : undefined,
            'key3' : {name: '123'},
            'key4' : undefined
        }

        ds._start = function() {
            test.ok(true);
            return Q.resolve();
        };

        ds._subscribeToStream = function(hash){

            test.ok(true);
            if(hash === 'key1'){
                return Q.reject('hash does not exist');
            } else {
                return Q.resolve(hash);
            }

        };

        ds._validateHash = function(hash) {
            test.ok(true);
            return hash !== 'key2';
        };

        ds.subscribe(hashes).then(
            function(h) {
                test.ok(!h[0].isFulfilled());
                test.ok(!h[1].isFulfilled());
                test.equal(h[2].valueOf(),'key3');
                test.equal(h[3].valueOf(),'key4');
                test.done();
            }, function(err) {
                test.ok(false);
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
            function(p){
                test.equal(p.state, 'subscribed');
                test.equal(p.hash, 'abc123');
                test.ok(ds.streams['abc123'].state, 'subscribed');
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();

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
                test.ok(!ds.streams.hasOwnProperty('abc123'));
                test.equal(err,"The hash abc123 doesn't exist");
                test.done();
            }
        )
        ds.emit('warning', "The hash abc123 doesn't exist");
    },

    'will return existing promise if attempting to subscribe already pending' : function(test) {
        var ds = DataSift.create('testuser', 'apyKey');
        var mockedPromise = {}
        var mockedDeferred = {promise:mockedPromise};
        ds.streams['abc123'] = {deferred : mockedDeferred, state: 'pending'};
        test.equal(mockedPromise, ds._subscribeToStream('abc123'));
        test.done();
    },

    'will not subscribe to warning twice' : function(test) {
        var ds = DataSift.create('a', 'b');
        var count = 0
        ds.on('newListener', function(){
            if(count > 0){
                test.ok(false);
                test.done();
            }
            count++;
        });

        ds.client = {};
        ds.client.write = function (body, encoding){

        };

        ds._subscribeToStream('abc123').then(
            function(p){
                ds._subscribeToStream('123').then(
                    function() {
                        test.equal(count,1);
                        test.done();
                    }
                )
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();
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

        ds.streams['123'] = '123';
        ds.streams['456'] = '456';
        ds.streams['abc'] = 'abc';

        ds._subscribeToStream = function(hash) {
            test.ok(!ds.streams.hasOwnProperty(hash));
            test.ok(true);
            return Q.resolve();
        };
        test.expect(6);
        ds._resubscribe();
        test.done();
    },

    'will handle subscribe rejects' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');

        ds.streams['123'] = '123';
        ds.streams['456'] = '456';
        ds.streams['abc'] = 'abc';

        ds._subscribeToStream = function(hash) {
            test.ok(!ds.streams.hasOwnProperty(hash));
            test.ok(true);
            return Q.reject();
        };

        test.expect(6);
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

        test.expect(3);

        ds.client.recover = function() {
            test.ok(true);
            return Q.resolve();
        };
        ds._resubscribe = function() {
            test.ok(true);
            test.done();
            return Q.resolve();
        }

        eventData.status = 'failure';

        ds.on('error', function (err) {
            test.ok(true);
        });
        ds._handleEvent(eventData);

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
        ds.streams['abc123'] = 'test123';
        ds.unsubscribe('abc123').then(
            function() {
                test.equal(Object.keys(ds.streams).length, 0);
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
            return Q.resolve();
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

exports['validateHash'] = {
    'success' : function(test) {
        var ds = DataSift.create('a', 'b');

        test.ok(ds._validateHash('69ec6f20f05f513e3b144b90fecc2e3f'));
        test.done();
    },

    'failure' : function(test) {
        var ds = DataSift.create('a','b');

        test.ok(!ds._validateHash('invalidHash'));
        test.ok(!ds._validateHash(''));
        test.ok(!ds._validateHash());
        test.ok(!ds._validateHash('69ec6f20f05f513e3b144b90fecc2e3fa'));
        test.ok(!ds._validateHash('69ec6f20f05f513e3b144b90fecc2e3'));
        test.ok(!ds._validateHash('69ec6f20f05f513e3b144b90fecc2e3 '));

        test.done();

    }
}

exports["hashDifference"] = {
    "success" : function(test) {
        var tc = new DataSift('keyId', 'key');

        var hashes1 = {x:"x", y:"y", z:"z"};
        var hashes2 = {a:"a", x:"x", y:"y"};

        test.deepEqual(tc._hashDifference(hashes1,hashes2), {z:'z'});
        test.deepEqual(tc._hashDifference(hashes2, hashes1), {a:'a'});
        test.done();
    },

    "will handle undefined object params" : function(test) {
        var tc = new DataSift('keyId', 'key');

        var hashes1 = {x:"x", y:"y", z:"z"};

        test.deepEqual(tc._hashDifference(undefined,hashes1), []);
        test.deepEqual(tc._hashDifference(hashes1, undefined), {x:'x', y:'y', z:'z'});
        test.done();
    }
}

