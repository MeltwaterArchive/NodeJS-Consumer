# DataSift stream consumer for NodeJS

This library gives easy access to the real-time data coming from a DataSift stream.

It connects to the DataSift streaming API, and emits all data received, automatically reconnecting as necessary.

Note that this module is promise based (via the Q library) and event based (via the EventEmitter).

## Prerequisites
- You have a DataSift account (username and API key) available from http://datasift.com

## Install
- Using npm `npm install datasift`
- Add it to your project `require('datasift.js');`

## Use

###create(username, apiKey, hostname, port)
Factory method which returns a DataSift instance

    //Create a datasift instance via the factory method like:
    var ds = DataSift.create('YOUR_ACCOUNT', 'YOUR_API_KEY');
###subscribe(streamHash)
Starts listening to the specific streams hashes given, putting the driver into the state passed in.
Multiple streams can be subscribed to per DataSift instance.  Overloaded so that either a string of single hash or an object keyed on the datasift hash

    var streams = ({'YOUR_STREAM_HASH_1' : {name: hash1}, 'YOUR_STREAM_HASH_2 : {name : hash2}, … YOUR_STREAM_HASH_N : {name: hashN});

    ds.subscribe(streams).then(
        function(resultingPromises) {
            resultingPromises.forEach( function(promise) {
            if(promise.isFulfilled()) {
                //promise.valueOf().name subscribed
            } else {
                //failed with reason promise.valueOf.exception
            }
	    }});
###unsubscribe(streamHash)
Unsubscribes to a stream already subscribed by the underlying connection to DataSift

    ds.unsubscribe('YOUR_STREAM_HASH').then(
        function() {
            //successfully unsubscribed
        }, function() {
            //failed to unsubscribe
        });
###shutdown()
Stop and disconnects to the DataSift stream.

    ds.shutdown();
###Putting it all together
See also the example.js file.

    var DataSift = require('datasift');

    // create a datasift instance via the factory method
    var ds = DataSift.create('YOUR_ACCOUNT', 'YOUR_API_KEY');

    ds.on('interaction', function (message) {
        //process the message;
    });

    // start listening to the stream:

    ds.subscribe(streams).then(
        function(resultingPromises) {
            resultingPromises.forEach( function(promise) {
		if(promise.isFulfilled()) {
			//promise.valueOf().hash subscribed
		} else {
			//failed with reason promise.valueOf.exception
		}
	    }
        });


## events emitted
###interaction(data)
    The interaction data collected from the DataSift stream.
###tick
    A tick event from DataSift, used to let the DataSift client know that the connection is still live.
###success
    A success event from DataSift.
###warning(message)
    Warnings about the state of the driver, bad status codes from the server, or incorrectly formatted JSON.
###connect
    The driver is connected to a DataSift stream.
###delete(data)
    A tweet was deleted on twitter and needs to be deleted by the client, if you are persisting the tweet interaction.
###error(error)
    Error coming from the DataSift stream.
####unknownEvent(data)
    An event coming from DataSift which its status cannot be determined.
###debug(message)
    Information relating the transition in state of the driver.  Used for debugging purposes.

##License

Copyright (c) 2012 LocalResponse Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
