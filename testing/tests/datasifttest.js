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
var nock = require('nock');

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
        ds.start('123').then(
            function() {
                test.ok(true);
                test.done();
            }
        ).end();
    }
}

exports['connect'] = {
    tearDown : function(cb) {
        DataSift.SOCKET_TIMEOUT = 60000;
        cb();
    },
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
            console.log(err);
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
        test.expect(1);

//        ds._transitionTo = function (state) {
//            test.ok(true);
//        };

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
    },

    'will reject on non-200 status code' : function(test) {

        test.expect(4);

        var server = http.createServer(function (req, res) {
            req.setEncoding('utf-8');
            req.on('data', function (data) {
                test.equal(data, '\n');
                res.writeHead(401)
                res.end('{"status":"failure","message":"Invalid API key given"}');
            });
        }).listen(1333, '127.0.0.1');

        var ds = DataSift.create('testuser', 'testapi', 'http://localhost/', 1333);

        ds._calculateReconnectDelay = function(){
            test.ok(true);
        };

        ds._connect().then(function(r) {
            server.close();
            test.ok(false);
            test.done();
        }, function (err)  {

            server.close();
            test.ok(true);
            test.notEqual(err.indexOf('Invalid API key given'), -1);
            test.done();
        }).end();
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
        //test.expect(4);
        ds._handleEvent = function (data) {
            testData.push(data);
        };

        ds.on('warning', function(message) {
            //console.log(message);
            //test.notEqual(message.indexOf('{"b" '), -1); //emits the bad json as a warning
            //test.ok(true);
        });

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

    },
//
//    'will handle poor json' : function(test) {
//        var chunk = '{"a":\n{"b":123}\n{"c":123\n}{a:123}';
//        var ds = DataSift.create('a','b');
//        var testData = [];
//
//        ds._handleEvent = function (data) {
//            testData.push(data);
//        };
//
//        ds.on('warning', function(d){
//            console.log(d);
//            test.ok(false);
//        });
//
//        ds._transitionTo = function (to) {
//        };
//        var chunk = '{"hash":"2c304a1f578a147e2d1e8c6235070a63", "data":{"interaction":{"schema":{"version":3},"source":"Tweet Button","author":{"username":"lakisharaychell","name":"lakisha raychelle","id":496357914,"avatar":"http://a0.twimg.com/profile_images/2736153135/50819749eb69ae714100a987e56312c2_normal.jpeg","link":"http://twitter.com/lakisharaychell"},"type":"twitter","created_at":"Sat, 20 Oct 2012 17:10:20 +0000","content":"Johnnie Taylor ~ Just Because: http://t.co/8dX54Ivj via @youtube this song makes me think of my ex","id":"1e21ad906de6a600e07499608187aeee","link":"http://twitter.com/lakisharaychell/statuses/259703108588957696"},"klout":{"score":11},"language":{"tag":"en","confidence":100},"salience":{"content":{"sentiment":0}},"twitter":{"created_at":"Sat, 20 Oct 2012 17:10:20 +0000","domains":["youtu.be"],"id":"259703108588957696","links":["http://youtu.be/HSXrGLVUGGQ"],"mention_ids":[10228272],"mentions":["YouTube"],"source":"<a href=\"http://twitter.com/tweetbutton\" rel=\"nofollow\">Tweet Button</a>","text":"Johnnie Taylor ~ Just Because: http://t.co/8dX54Ivj via @youtube this song makes me think of my ex","user":{"name":"lakisha raychelle","description":"im very laid back and like to have fun loveme sone reality tv and proud of it \r\n","location":"greensboro , nc","statuses_count":98,"followers_count":14,"friends_count":89,"screen_name":"lak{"hash":"2c304a1f578a147e2d1e8c6235070a63", "data":{"interaction":{"schema":{"version":3},"source":"Tweet Button","author":{"username":"lakisharaychell","name":"lakisha raychelle","id":496357914,"avatar":"http://a0.twimg.com/profile_images/2736153135/50819749eb69ae714100a987e56312c2_normal.jpeg","link":"http://twitter.com/lakisharaychell"},"type":"twitter","created_at":"Sat, 20 Oct 2012 17:10:20 +0000","content":"Johnnie Taylor ~ Just Because: http://t.co/8dX54Ivj via @youtube this song makes me think of my ex","id":"1e21ad906de6a600e07499608187aeee","link":"http://twitter.com/lakisharaychell/statuses/259703108588957696"},"klout":{"score":11},"language":{"tag":"en","confidence":100},"salience":{"content":{"sentiment":0}},"twitter":{"created_at":"Sat, 20 Oct 2012 17:10:20 +0000","domains":["youtu.be"],"id":"259703108588957696","links":["http://youtu.be/HSXrGLVUGGQ"],"mention_ids":[10228272],"mentions":["YouTube"],"source":"<a href=\"http://twitter.com/tweetbutton\" rel=\"nofollow\">Tweet Button</a>","text":"Johnnie Taylor ~ Just Because: http://t.co/8dX54Ivj via @youtube this song makes me think of my ex","user":{"name":"lakisha raychelle","description":"im very laid back and like to ha';
//        ds._onData(chunk);
//
//        test.done();
//    }
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

    'will not attempt to reconnect when status code is 404 or 401 (bad hash code or bad credentials)' : function(test) {
        var ds = DataSift.create('a','b','c','d');

        ds.on('warning', function(message){
            test.ok(true);
        });

        test.expect(4);
        ds.statusCode = 401;
        ds._onEnd();
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
            return Q.resolve();
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
            ds.statusCode = 200;
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
    },

    'will handle connect reject with bad status code' : function(test) {
        var ds = DataSift.create('testuser', 'apyKey');
        test.expect(2);

        ds._connect = function() {
            test.ok(true);
            ds.statusCode = 401;
            return Q.reject();
        };

        ds._establishConnection().then(
            function() {

            }, function (err) {
                test.ok(true);
                test.done();
            }
        ).end();
    },

    'will handle a subscribe failure' : function(test) {
        var ds = DataSift.create('a', 'b');
        var request = {};
        test.expect(6);

        request.on = function(label,cb){
            test.ok(true);
        };

        ds._subscribe = function(){
            test.ok(true);
            return Q.reject();
        };
        ds._disconnect = function(){
            test.ok(true);
        };

        ds._connect = function() {
            test.ok(true);
            return Q.resolve(request);
        };

        ds._establishConnection().then(
            function() {
                test.ok(false);
                test.done();
            }, function(err) {
                test.ok(true);
                test.done();
            }
        ).end();
    }

}

exports['subscribe'] = {
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
        ds.hash = 'abc123';

        ds.connectionState = 'connected';
        ds.request = {};
        ds.request.write = function (body, encoding){
            test.equal(body,'{"action":"subscribe","hash":"abc123"}' );
        };

        ds._subscribe().then(
            function(){
                test.done();
            }
        ).end();
        //test.done();
    },

    'will immediately resolve if connectionState is disconnected' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');
        ds.connectionState = 'disconnected';
        ds.request = {};

        ds.request.write = function () {
            test.ok(false);
        };

        ds._subscribe().then(
            function() {
                test.done();
            }
        ).end();

    },
    'will reject if a warning with invalid credentials is emitted' : function(test) {
        var ds = DataSift.create('testuser', 'apiKey');
        ds.hash = 'abc123';

        ds.connectionState = 'connected';
        ds.request = {};

        ds.request.write = function (body, encoding){
            test.equal(body,'{"action":"subscribe","hash":"abc123"}' );
        };

        ds._subscribe().then(
            function(){
                test.ok(false);
                test.done();
            }, function(err){
                test.notEqual(err.indexOf('abc123'), -1);
                test.done();
            }
        )
        ds.emit('warning', 'You did not send a valid hash to subscribe to')

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
            return Q.resolve();
        };

        this.ds.on('connect', function(){
            test.ok(true);
        });
        var self = this;
        this.ds._transitionTo('connected').then(
            function(){
                test.equal(self.ds.connectionState, 'connected');
                test.done();
            }
        ).end();
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

//exports['intergrationTest'] = {
//    tearDown : function(cb) {
//        DataSift.SOCKET_TIMEOUT = 60000;
//        cb();
//    },
//    'success' : function (test) {
//        DataSift.SOCKET_TIMEOUT = 10000;
//
//        var interactionData1 = {"test" : "def", "name" : "jon", "number" : 1};
//        var eventData1 = { "hash": "123" , "data" : {"interaction": interactionData1}};
//        var interactionData2 = {"test" : "abc", "name" : "jon", "number" : 1};
//        var eventData2 = { "hash": "456" , "data" : {"interaction": interactionData2}};
//        var lastTime;
//
//        var server = http.createServer(function (req, res) {
//            req.setEncoding('utf-8');
//            req.on('data', function (data) {
//                console.log('data: ' + data);
//                res.write(' ');
//                if(data.indexOf('"subscribe"') !== -1) {
//                    if(lastTime === undefined) {
//                        lastTime = Date.now();
//                    } else {
//                        console.log(Date.now() - lastTime);
//                        lastTime = Date.now();
//                    }
//                    console.log('writing data');
//                    //res.write(JSON.stringify(eventData1) + '\n');
//                    //res.write(JSON.stringify(eventData2) + '\n');
//                    //res.write('{"hash":"2c304a1f578a147e2d1e8c6235070a63", "data":{"interaction":{"schema":{"version":3},"source":"Tweet Button","author":{"username":"lakisharaychell","name":"lakisha raychelle","id":496357914,"avatar":"http://a0.twimg.com/profile_images/2736153135/50819749eb69ae714100a987e56312c2_normal.jpeg","link":"http://twitter.com/lakisharaychell"},"type":"twitter","created_at":"Sat, 20 Oct 2012 17:10:20 +0000","content":"Johnnie Taylor ~ Just Because: http://t.co/8dX54Ivj via @youtube this song makes me think of my ex","id":"1e21ad906de6a600e07499608187aeee","link":"http://twitter.com/lakisharaychell/statuses/259703108588957696"},"klout":{"score":11},"language":{"tag":"en","confidence":100},"salience":{"content":{"sentiment":0}},"twitter":{"created_at":"Sat, 20 Oct 2012 17:10:20 +0000","domains":["youtu.be"],"id":"259703108588957696","links":["http://youtu.be/HSXrGLVUGGQ"],"mention_ids":[10228272],"mentions":["YouTube"],"source":"<a href=\"http://twitter.com/tweetbutton\" rel=\"nofollow\">Tweet Button</a>","text":"Johnnie Taylor ~ Just Because: http://t.co/8dX54Ivj via @youtube this song makes me think of my ex","user":{"name":"lakisha raychelle","description":"im very laid back and like to have fun loveme sone reality tv and proud of it \r\n","location":"greensboro , nc","statuses_count":98,"followers_count":14,"friends_count":89,"screen_name":"lak{"hash":"2c304a1f578a147e2d1e8c6235070a63", "data":{"interaction":{"schema":{"version":3},"source":"Tweet Button","author":{"username":"lakisharaychell","name":"lakisha raychelle","id":496357914,"avatar":"http://a0.twimg.com/profile_images/2736153135/50819749eb69ae714100a987e56312c2_normal.jpeg","link":"http://twitter.com/lakisharaychell"},"type":"twitter","created_at":"Sat, 20 Oct 2012 17:10:20 +0000","content":"Johnnie Taylor ~ Just Because: http://t.co/8dX54Ivj via @youtube this song makes me think of my ex","id":"1e21ad906de6a600e07499608187aeee","link":"http://twitter.com/lakisharaychell/statuses/259703108588957696"},"klout":{"score":11},"language":{"tag":"en","confidence":100},"salience":{"content":{"sentiment":0}},"twitter":{"created_at":"Sat, 20 Oct 2012 17:10:20 +0000","domains":["youtu.be"],"id":"259703108588957696","links":["http://youtu.be/HSXrGLVUGGQ"],"mention_ids":[10228272],"mentions":["YouTube"],"source":"<a href=\"http://twitter.com/tweetbutton\" rel=\"nofollow\">Tweet Button</a>","text":"Johnnie Taylor ~ Just Because: http://t.co/8dX54Ivj via @youtube this song makes me think of my ex","user":{"name":"lakisha raychelle","description":"im very laid back and like to ha');
//                    res.write('{"hash":"2c304a1f578a147e2d1e8c6235070a63", "data":{"interaction":{"schema":{"version":3},"source":"Tweet Button","author":{"username":"NicoArqueros","name":"Nicolas Arqueros","id":68308933,"avatar":"http://a0.twimg.com/profile_images/2364599345/tu1sasgblpwwzcdinmit_normal.jpeg","link":"http://twitter.com/NicoArqueros"},"type":"twitter","created_at":"Sat, 20 Oct 2012 17:09:16 +0000","content":"Wow! Totally redesigned @bitbucket! Unlimited private git and hg repos, 5 users free and in-line commenting. #git #hg http://t.co/sNbuoP81","id":"1e21ad8e0b8ca600e074ae4679a850f8","link":"http://twitter.com/NicoArqueros/statuses/259702840069611520"},"klout":{"score":40},"language":{"tag":"en","confidence":100},"links":{"created_at":["Fri, 19 Oct 2012 20:45:48 +0000"],"retweet_count":[0],"title":["Free source code hosting for Git and Mercurial by Bitbucket"],"url":["https://bitbucket.org/"]},"salience":{"content":{"sentiment":0}},"twitter":{"created_at":"Sat, 20 Oct 2012 17:09:16 +0000","domains":["ow.ly"],"id":"259702840069611520","links":["http://ow.ly/egtr5"],"mention_ids":[174379786],"mentions":["bitbucket"],"source":"<a href=\"http://twitter.com/tweetbutton\" rel=\"nofollow\">Tweet Button</a>","text":"Wow! Totally redesigned @bitbucket! Unlimited private git and hg repos, 5 users free and in-line commenting. #git #hg http://t.co/sNbuoP81","user":{"{"hash":"2c304a1f578a147e2d1e8c6235070a63", "data":{"interaction":{"schema":{"version":3},"source":"Tweet Button","author":{"username":"NicoArqueros","name":"Nicolas Arqueros","id":68308933,"avatar":"http://a0.twimg.com/profile_images/2364599345/tu1sasgblpwwzcdinmit_normal.jpeg","link":"http://twitter.com/NicoArqueros"},"type":"twitter","created_at":"Sat, 20 Oct 2012 17:09:16 +0000","content":"Wow! Totally redesigned @bitbucket! Unlimited private git and hg repos, 5 users free and in-line commenting. #git #hg http://t.co/sNbuoP81","id":"1e21ad8e0b8ca600e074ae4679a850f8","link":"http://twitter.com/NicoArqueros/statuses/259702840069611520"},"klout":{"score":40},"language":{"tag":"en","confidence":100},"links":{"created_at":["Fri, 19 Oct 2012 20:45:48 +0000"],"retweet_count":[0],"title":["Free source code hosting for Git and Mercurial by Bitbucket"],"url":["https://bitbucket.org/"]},"salience":{"content":{"sentiment":0}},"twitter":{"created_at":"Sat, 20 Oct 2012 17:09:16 +0000","domains":["ow.ly"],"id":"259702840069611520","links":["http://ow.ly/egtr5"],"mention_ids":[174379786],"mentions":["bitbucket"],"source":"<a href=\"http://twitter.com/tweetbutton\" rel=\"nofollow\">Tweet Button</a>","text":"Wow! Totally redesigned @bitbucket! Unlimited private git and hg repos, 5 users free and in-line commenting. #git #hg http://t.co/sNbuoP81","user":{"name":"Nicolas Arqueros","description":"Always looking for something interesting that fulfills my need for a good challenge. Love my kindle and business books.","location":"Vi\u00F1a del Mar","statuses_count":698,"followers_count":288,"friends_count":372,"screen_name":"NicoArqueros","lang":"en","time_zone":"Santiago","utc_offset":-14400,"listed_count":1,"id":68308933,"id_str":"68308933","geo_enabled":true,"created_at":"Mon, 24 Aug 2009 02:55:55 +0000"}}}}');
//                    res.write('name":"Nicolas Arqueros","description":"Always looking for something interesting that fulfills my need for a good challenge. Love my kindle and business books.","location":"Vi\u00F1a del Mar","statuses_count":698,"followers_count":288,"friends_count":372,"screen_name":"NicoArqueros","lang":"en","time_zone":"Santiago","utc_offset":-14400,"listed_count":1,"id":68308933,"id_str":"68308933","geo_enabled":true,"created_at":"Mon, 24 Aug 2009 02:55:55 +0000"}}}}');
//                    var timeout1 = setTimeout(function(){
//                        console.log('ending connection');
//                        res.end();
//                    }, 1000);
//                }
//
//            });
//        }).listen(1333, '127.0.0.1');
//
//        var ds = DataSift.create('testuser', 'testapi', 'http://localhost/', 1333);
////        ds._handleEvent = function (e){
////            console.log(e);
////        };
//
//        ds.on('interaction', function(e){
//            console.log(e);
//        });
//
//        ds.on('warning', function(m){
//            console.log(m);
//        });
//
//        ds.start('123').then(function() {
//            console.log('connected');
//            var timeout = setTimeout(function(){
//                console.log('timeout');
//                server.close();
//                test.done();
//            }, 10000);
//
//        }, function (err)  {
//            console.log(err);
//
//        });
//
//        ds.start('123').then(function() {
//            console.log('connected');
//            var timeout = setTimeout(function(){
//                console.log('timeout');
//                server.close();
//                test.done();
//            }, 10000);
//
//        }, function (err)  {
//            console.log('this is an error');
//            console.log(err);
//
//        });
//    }
//}