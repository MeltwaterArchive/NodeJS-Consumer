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
###start(streamHash)
Starts listening to the specific stream hash given, returning a completion promise.
    
    ds.start('YOUR_STREAM_HASH').then(
        function() {
            //successful start
        }, function(err) {
            //error starting the listener
        });
###stop()
Stop and disconnects to the DataSift stream.

    ds.stop();
###Putting it all together
See also the example.js file.

    var DataSift = require('datasift');

    // create a datasift instance via the factory method
    var ds = DataSift.create('YOUR_ACCOUNT', 'YOUR_API_KEY');

    // start listening to the stream:

    ds.start('YOUR_STREAM_HASH').then(
        function () {
            console.log("Connected to DataSift");
        },
        function () {
            console.log("Error connecting to DataSift");
        }
    );

    ds.on('interaction', function (message) {
        //process the message;
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