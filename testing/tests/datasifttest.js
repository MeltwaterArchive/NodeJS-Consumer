/**
 * User: wadeforman
 * Date: 8/31/12
 * Time: 1:55 PM
 */

"use strict"

var http = require('http');
var DataSift = require('../../datasift');
var Q = require('q');
var EventEmitter = require('events').EventEmitter;


exports['create'] = {
    'can create instance with host and port params' : function (test) {
        var ds = DataSift.create('testuser','apiKey','http://testurl.com/',90);
        test.equal(ds.port, 90);
        test.equal(ds.host, 'http://testurl.com/');
        test.equal(ds.connectionState, 'disconnected');
        test.done();
    },

    'can create instance without host and port params' : function (test) {
        var ds = DataSift.create('testuser', 'apikey');
        test.equal(ds.port, 80);
        test.equal(ds.host, 'http://stream.datasift.com/');
        test.equal(ds.connectionState, 'disconnected');
        test.done();
    },

    'requires a username' : function(test) {
        test.throws(
            function() {
              DataSift.create();
            }, Error
        );
        test.done();
    },

    'requires a apiKey' : function(test) {
        test.throws(
            function() {
                DataSift.create('testuser');
            }, Error
        );
        test.done();
    }
}

exports['start'] = {

    'success' : function (test) {
        var ds = DataSift.create('testuser','apiKey','http://datasifter.com/',80);

        test.expect(1);

        ds._establishConnection = function () {
            test.ok(true);
            return Q.resolve();
        };

        ds.start().then( function () {
            test.done()
        }, function () {
            test.ok(false);
            test.done();
        }).end();
    },

    'will resolve immediately if in any connection state other than disconnected' : function (test) {
        var ds = DataSift.create('a','b');
        ds.connectionState = 'connected';
        ds.start('123', false).then(
            function() {
                test.ok(true);
                test.done();
            }
        ).end();
    }
}

exports['connect'] = {
       'success' : function (test) {
        test.expect(3);

        var server = http.createServer(function (req, res) {
            req.setEncoding('utf-8');
            req.on('data', function (data) {
                test.equal(data, '\n');
                res.end();
            });
        }).listen(1333, '127.0.0.1');

        var ds = DataSift.create('testuser', 'testapi', 'http://localhost/', 1333);

        ds._calculateReconnectDelay = function(){
            test.ok(true);
        };

        ds._connect().then(function(r) {
            test.notEqual(r, null);
            server.close();
            test.done();
        }, function (err)  {
            test.ok(false);
            server.close();
            test.done();
        }).end();

    },

    'rejects when end point refuses the connection' : function (test) {
        test.expect(1);
        var ds = DataSift.create('testuser', 'testapi', 'http://localhost/', 1336);
        ds._connect().then(function(){
            test.ok(false);
            test.done();
        }, function (err)  {
            test.ok(true);
            test.done();
        }).end();
    },

    'rejects on socket timeout' : function (test) {
        var url = 'http://www.datasift.com/'
        var ds = DataSift.create('testuser','apiKey',url,80);
        DataSift.SOCKET_TIMEOUT = 1;
        test.expect(2);

        ds._transitionTo = function (state) {
            test.ok(true);
        };

        ds._connect().then( function () {
            test.ok(false);
            test.done();
        }, function (err) {
            test.ok(true);
            test.done();
        });
    },

    'will resolve immediately if connection state is not disconnected' : function (test) {
        var url = 'http://www.datasift.com/'
        var ds = DataSift.create('testuser','apiKey',url,80);
        ds.connectionState = 'connected';
        test.expect(1);
        ds._connect().then(
            function() {
                test.ok(true);
                test.done();
            }
        ).end();
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

        ds.on('warning', function(message) {
            test.notEqual(message.indexOf('{"b" '), -1); //emits the bad json as a warning
        });

        var chunk = '{"a" : 1}\n{"b" \n{"c":3}\n{"c":\n{"d":';
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
    'will handle non-200 status codes' : function (test) {
        var ds = DataSift.create('a','b','c','d');

        ds.statusCode = 400;
        ds.responseData = 'not found';
        ds.connectionState = 'connected';
        ds.on('warning', function(message){
            test.ok(true);
        });

        ds._transitionTo = function(to) {
            test.equal(to,'connected');
        };

        ds._onEnd();
        test.expect(3);
        test.done();
    },

    'will handle complete event data in the response buffer' : function (test) {
        var ds = DataSift.create('a','b','c','d');

        ds.statusCode = 200;
        ds.responseData = '{"a" : 1}';
        ds.connectionState = 'connected';
        var testData = [];

        ds.on('warning', function(message){
            test.ok(true);
        });

        ds._transitionTo = function(to) {
            test.equal(to,'connected');
        };

        ds._handleEvent = function(eventData) {
            testData.push(eventData);
        };

        ds._onEnd();
        test.deepEqual(testData, [{a:1}]);
        test.expect(3);
        test.done();
    },

    'will handle incomplete event data in the response buffer' : function (test) {
        var ds = DataSift.create('a','b','c','d');

        ds.statusCode = 200;
        ds.responseData = 'no { t j son -';
        ds.connectionState = 'connected';
        ds.on('warning', function(message){
            test.ok(true);
        });

        ds._transitionTo = function(to) {
            test.equal(to,'connected');
        };

        ds._onEnd();
        test.expect(3);
        test.done();
    },
    'will handle bad credentials 401 status code' : function(test){
        var ds = DataSift.create('a','b');
        ds._transitionTo = function (to) {
            test.equal(to,'disconnected');
        };

        ds.statusCode = 401;

        ds._onEnd();
        test.done();
    },

    'will handle bad stream hash with 404 status' : function (test) {
        var ds = DataSift.create('a','b');
        ds._transitionTo = function (to) {
            test.equal(to,'disconnected');
        };

        ds.statusCode = 404;

        ds._onEnd();
        test.done();
    }


}

exports['establishConnection'] = {
    'success' : function(test) {
        var ds = DataSift.create('testuser', 'apyKey');
        var response = {};
        test.expect(4);
        response.on = function(eventName, callback) {
            test.ok(true);
        };

        ds._subscribe = function(){
            test.ok(true);
        };

        ds._connect = function() {
            test.ok(true);
            return Q.resolve(response);
        };
        ds._establishConnection().then(
            function() {
               test.done()
            }, function (err) {
                console.log(err);
                console.log(err.stack);
                test.ok(false);
                test.done();
            }
        ).end();
    },

    'will handle connect reject' : function (test) {
        var ds = DataSift.create('testuser', 'apyKey');
        test.expect(4);

        ds._connect = function() {
            test.ok(true);
            return Q.reject();
        };

        ds._transitionTo = function(state){
            test.ok(true);
        };

        ds._establishConnection().then(
            function() {
                test.ok(true);
                test.equal(ds.connectionState, 'disconnected');
                test.done();
            }, function (err) {
                test.ok(false);
                test.done();
            }
        ).end();
    }
}

exports['subscribe'] = {
    'will subscribe to a stream' : function (test) {

        var ds = DataSift.create('testuser', 'apyKey');
        ds.hash = 'abc123';

        ds.connectionState = 'connected';
        ds.request = {}
        ds.request.write = function (body, encoding){
            test.equal(body,'{"action":"subscribe","hash":"abc123"}' );
        };

        ds._subscribe();
        test.done();
    },

    'will immediately resolve if connectionState is disconnected' : function(test) {
        var ds = DataSift.create('testuser', 'apyKey');
        ds.connectionState = 'disconnected';
        ds.request = {};
        ds.request.write = function () {
            test.ok(false);
        };

        ds._subscribe();
        test.done();
    }
}

exports['stop'] = {
    'will unsubscribe and disconnect' : function (test) {

        var url = 'http://datasifter.com/'
        var ds = DataSift.create('testuser','apiKey',url,80);
        ds.request = {};
        ds.connectionState = 'connected';
        test.expect(2);

        ds._unsubscribe = function () {
            test.ok(true);
            return Q.resolve();
        };

        ds._disconnect = function () {
            test.ok(true);
            return Q.resolve();
        };

        ds.stop().then(function () {
            test.done()
        }).end();
    },

    'will resolve even if not connected' : function (test) {
        var ds = DataSift.create('testuser', 'testapi');

        test.expect(1);
        ds.stop().then( function() {
            test.ok(true);
            test.done();
        }).end();
    }
}

exports['unsubscribe'] = {

    'will unsubscribe from data sift servers' : function (test) {
        var ds = DataSift.create('testuser', 'apyKey');
        ds.hash = 'abc123';
        ds.connectionState = 'connected';
        test.expect(1);

        ds.request = {}
        ds.request.write = function (body, encoding){
            test.equal(body,'{"action":"unsubscribe","hash":"abc123"}' );
        };

        ds._unsubscribe();
        test.done();
    },

    'will immediately resolve if connectionState is not connected' : function(test) {
        var ds = DataSift.create('testuser', 'apyKey');
        ds.connectionState = 'disconnected';
        ds.request = {};

        ds.request.write = function () {
            test.ok(false);
        };

        ds._unsubscribe();
        test.done();
    }
}

exports['disconnect'] = {
    'will disconnect from the datasift servers' : function (test) {
        var ds = DataSift.create('testuser', 'apyKey');

        ds.connectionState = 'connected';
        ds.request = {};
        ds.request.write = function (body, encoding){
            test.equal(body,'{"action":"stop"}' );
        };

        ds._disconnect();
        test.done();
    },

    'will immediately resolve if connectionState is not connected' : function(test) {
        var ds = DataSift.create('testuser', 'apyKey');
        ds.connectionState = 'disconnected';
        ds.request = {};

        ds.request.write = function () {
            test.ok(false);
        };

        ds._disconnect();
        test.done();
    }
}

exports['handleEvent'] = {
    'success' : function (test) {
        var url = 'http://datasifter.com/'
        var ds = DataSift.create('testuser','apiKey',url,80);
        var interactionData = {'test' : 'abc', 'name' : 'jon', 'number' : 1};
        var eventData = { 'hash': '123' , 'data' : {'interaction': interactionData}};
        test.expect(1);
        ds.on('interaction', function (eventReceived) {
            test.deepEqual(eventReceived, eventData);
            test.done();
        });

        ds._handleEvent(eventData);
    },

    'will emit error if the status is error' : function (test) {
        var url = 'http://datasifter.com/'
        var ds = DataSift.create('testuser','apiKey',url,80);
        var eventData = {};
        ds.request = {};
        test.expect(2);

        ds._transitionTo = function(stateTo) {
            test.equal(stateTo, 'connected');
        };

        eventData.status = 'failure';

        ds.on('error', function (err) {
            test.ok(true);
        });
        ds._handleEvent(eventData);
        test.done();
    },

    'will emit warning if data json status is a warning' : function (test) {
        var url = 'http://datasifter.com/'
        var ds = DataSift.create('testuser','apiKey',url,80);
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
        var url = 'http://datasifter.com/'
        var ds = DataSift.create('testuser','apiKey',url,80);
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
        var url = 'http://datasifter.com/'
        var ds = DataSift.create('testuser','apiKey',url,80);
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
        var ds = DataSift.create('testuser','apiKey',url,80);
        var eventData = {unknown : 123};
        test.expect(1);
        ds.on('unknownEvent', function (jsonReceived) {
            test.deepEqual(jsonReceived, eventData);
            test.done();
        });

        ds._handleEvent(eventData);
    },


    'will clean up connection on disconnect from DataSift' : function (test) {
        var url = 'http://datasifter.com/'
        var ds = DataSift.create('testuser','apiKey',url,80);
        var eventData = {};
        ds.request = {};
        test.expect(1);

        eventData.status = 'failure';
        eventData.message = 'A stop message was received. You will now be disconnected';

        ds._transitionTo = function (to) {
            test.equal(to, 'disconnected');
        };

        ds._handleEvent(eventData);
        test.done();
    }
}

exports['calculateReconnectionDelay'] = {
    'will calculate reconnect timer' : function(test) {
        var ds = DataSift.create('testuser', 'testapi');

        test.equal(ds._calculateReconnectDelay(), 0);
        test.equal(ds.reconnectAttempts, 1);

        test.equal(ds._calculateReconnectDelay(), 10000);
        test.equal(ds.reconnectAttempts, 2);

        ds.reconnectAttempts = 3
        test.equal(ds._calculateReconnectDelay(), 40000);

        ds.reconnectAttempts = 1000;
        test.equal(ds._calculateReconnectDelay(), 320000);

        test.done();
    }
}

exports['transitionTo'] = {

    setUp: function (cb) {
        this.ds = DataSift.create('a','b','c','d');
        cb();
    },

    'will transition to disconnected from connected' : function (test) {
        this.ds.connectionState = 'connected';
        test.expect(4);
        this.ds._unsubscribe = function (){
            test.ok(true);
        };

        this.ds._disconnect = function() {
            test.ok(true);
        };

        this.ds._transitionTo('disconnected');
        test.equal(this.ds.request, null);
        test.equal(this.ds.connectionState, 'disconnected');

        test.done();
    },

    'will transition to disconnected from connecting' : function (test) {
        this.ds.connectionState = 'connecting';
        test.expect(3);

        this.ds._disconnect = function() {
            test.ok(true);
        };

        this.ds._transitionTo('disconnected');
        test.equal(this.ds.request, null);
        test.equal(this.ds.connectionState, 'disconnected');

        test.done();

    },

    'will transition to disconnected from disconnected' : function (test) {
        this.ds.connectionState = 'disconnected';
        this.ds._transitionTo('disconnected');
        test.equal(this.ds.request, null);
        test.equal(this.ds.connectionState, 'disconnected');
        test.done();
    },

    'will transition to connected from connecting' : function (test) {
        test.expect(3);
        this.ds.connectionState = 'connecting';
        this.ds._subscribe = function() {
            test.ok(true);
        };

        this.ds.on('connect', function(){
            test.ok(true);
        });

        this.ds._transitionTo('connected');
        test.equal(this.ds.connectionState, 'connected')
        //test.equal(this.ds.reconnectAttempts, 0);
        test.done();
    },

    'will handle a transition to connected form a non connecting state' : function (test) {
        this.ds.connectionState = 'connected';
        this.ds._establishConnection = function () {
            test.ok(true);
        };
        this.ds._transitionTo('connected');
        test.expect(1);
        test.done();
    },

    'will transition to connecting from a disconnected state' : function (test) {
        this.ds.connectionState = 'disconnected';

        test.expect(2);

        this.ds._establishConnection = function () {
            test.ok(true);
            self.ds.connectionState = 'connecting';
            return Q.resolve();
        };

        var self = this;
        this.ds._transitionTo('connecting').then(
            function(){
                test.equal(self.ds.connectionState, 'connecting');
                test.done();
            }, function (err) {
                console.log(err.stack);
                console.log(err);
                test.ok(false);
                test.done();
            }
        ).end();
    },

    'will handle transition to an error state' : function (test) {
        test.expect(1);

        this.ds._establishConnection = function () {
            test.ok(true);
            return Q.resolve();
        };

        this.ds._transitionTo('error');
        test.done();
    },

    'will handle transitions to connecting and not be in a disconnected state' : function (test) {
        this.ds.connectionState = 'connected';
        var self = this;
        test.expect(2);

        this.ds._establishConnection = function () {
            test.ok(true);
            self.ds.connectionState = 'connecting';
            return Q.resolve();
        };

        this.ds._transitionTo('connecting');
        test.equal(self.ds.connectionState, 'connecting');
        test.done();
    }
}

