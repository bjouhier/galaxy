"use strict";
var streams = require('galaxy-streams');
var galaxy = require('galaxy');
var url = require('url');
var qs = require('querystring');

var begPage = '<html><head><title>My Search</title></head></body>' + //
'<form action="/">Search: ' + //
'<input name="q" value="{q}"/>' + //
'<input type="submit"/>' + //
'</form><hr/>';
var endPage = '<hr/>generated in {ms}ms</body></html>';

var server = streams.createHttpServer(function*(request, response) {
	var query = qs.parse(url.parse(request.url).query),
		t0 = new Date();
	response.writeHead(200, {
		'Content-Type': 'text/html; charset=utf8'
	});
	yield response.write(begPage.replace('{q}', query.q || ''));
	yield response.write(yield search(query.q));
	yield response.write(endPage.replace('{ms}', new Date() - t0));
	yield response.write();
});

function* search(q) {
	return "NIY: " + q;
}

galaxy.main(function *() {
	yield server.listen(1337);
	console.log('Server running at http://127.0.0.1:1337/');
});
