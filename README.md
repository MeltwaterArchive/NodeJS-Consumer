# DataSift consumer for NodeJS

This library gives easy access to the real-time data coming from one or more DataSift streams.

It connects to the DataSift streaming API, and emits all data received. It can also handle multiple stream simultaneously.

## Prerequesites
- You have some experience of NodeJS
- You have a DataSift account (username and API key) available from http://datasift.com

## Install
- Using npm `npm install datasift`
- Download datasift.js and add it to your project `require('/path/to/datasift.js');`

## Use
- See the example.js script for how to use the library

## Changelog

### 0.3.1 - 8th Feb 2013
- Increase socket activity check timeout to 65 seconds to ensure we don't get disconnected early

### 0.3.0 - 6th Feb 2013
- Disconnect method destroys socket
- Added a timer to disconnect if there has been no activity on the socket for 35 seconds
