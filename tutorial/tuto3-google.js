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
	if (!q || /^\s*$/.test(q)) return "Please enter a text to search";
	// pass it to Google
	var response = yield streams.httpRequest({
		url: 'http://ajax.googleapis.com/ajax/services/search/web?v=1.0&q=' + q,
		proxy: process.env.http_proxy
	}).end().response();
	var json = yield response.checkStatus(200).readAll();
	// parse JSON response
	var parsed = JSON.parse(json);
	// Google may refuse our request. Return the message then.
	if (!parsed.responseData) return "GOOGLE ERROR: " + parsed.responseDetails;
	// format result in HTML
	return '<ul>' + parsed.responseData.results.map(function(entry) {
		return '<li><a href="' + entry.url + '">' + entry.titleNoFormatting + '</a></li>';
	}).join('') + '</ul>';
}

galaxy.main(function *() {
	yield server.listen(1337);
	console.log('Server running at http://127.0.0.1:1337/');
});
