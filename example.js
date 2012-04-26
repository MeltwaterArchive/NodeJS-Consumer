//Include the DataSift consumer
//var DataSift = require('/path/to/datasift.js');	//When downloading datasift.js
var DataSift = require('datasift');					//When using npm installation

//Create a new instance of the DataSift consumer
var consumer = new DataSift('username', 'api_key');

//Connect
consumer.connect();

//Emitted when stream is connected
consumer.on("connect", function(){
	console.log("Connected!");
	//Subscribe to Foursquare and Gowalla checkins
	consumer.subscribe('e4941c3a0b4a905314ce806dea26e0d7'); 
});

//Emitted when there is an error
consumer.on("error", function(error){
	console.log("Error: " + error.message);
});

//Emitted when there is a warning
consumer.on("warning", function(message){
	console.log("Warning: " + message);
});

//Emitted when disconnected
consumer.on("disconnect", function(){
	console.log("Disconnected!");
});

//Emitted when an interaction is received
consumer.on("interaction", function(data){
	console.log("Received data: " + JSON.stringify(data));
});

//Emitted when a delete message is received
consumer.on("delete", function(data){
	console.log("Delete: " + JSON.stringify(data));
});
