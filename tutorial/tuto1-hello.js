"use strict";
var galaxy = require('galaxy');
var streams = require('galaxy-streams');

var server = streams.createHttpServer(function *(request, response) {
	response.writeHead(200, {
		'Content-Type': 'text/plain; charset=utf8'
	});
	response.end("Hello world!");
});

galaxy.main(function *() {
	yield server.listen(1337);
	console.log('Server running at http://127.0.0.1:1337/');
});
