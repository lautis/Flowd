require.paths.unshift('commands');
querystring = require('querystring');
https = require('https');
fs = require('fs');
exec = require('child_process').exec;
require.paths.unshift('.');
jsdom = require('jsdom').jsdom;

var Flowd = {};

Flowd.start = (function() {
  var config = {};
  // require config
  try {
    if (fs.lstatSync('config.js')) {
      config = require('./config');
    }
  } catch(e) {
  }
  config.username = process.env.FLOWD_USERNAME || config.username;
  config.password = process.env.FLOWD_PASSWORD || config.password;
  config.flowname = process.env.FLOWD_FLOWNAME || config.flowname || 'flowd';
  config.messageHost = process.env.FLOWD_MESSAGE_HOST || config.messageHost;
  config.updateInterval = config.updateInterval || 3000;
  config.syntaxErrorMessage = config.syntaxErrorMessage || 'Huh?';

	var sessionOptions = {
		host: 'www.flowdock.com',
		port: 443,
		path: '/session',
		method: 'POST',
		headers:{
			"Connection": "keep-alive"
		}
	};
	
	var cookie;
	var updateInterval = config.updateInterval;
	var last_sent_at = new Date().getTime();

	// evaluate commands from file
	var availableCommands = {};
	var files = fs.readdirSync('commands');
	for(var i = 0;i < files.length; i++){
		file = files[i];
		if (file.match(/\.js$/)){
			command = file.replace(/\.js$/, "");
			availableCommands[command] = require(command);
		}
	}
		
	var auth = function(){
		var params = querystring.stringify({'user_session[email]': config.username,  'user_session[password]': config.password});
		var req = https.request(sessionOptions, function(res) {
			res.on("end", function(){
				cookie = res.headers['set-cookie'];
				pollForMessages(cookie);
			});
		});
		req.end(params);
		req.on('error', function(e) {
			console.error(e);
		});
	};
	
	// this is the main loop
	var pollForMessages = function(){
		setInterval(function(){
			getMessages();
		}, process.env.UPDATE_INTERVAL || config.updateInterval || 3000);
	};

	var getMessages = function() {
			var refreshTime = new Date().getTime();
			var totalData = "";
			var getMessageOptions = {
				host: process.env.MESSAGE_HOST || config.messageHost,
				port: 443,
				path: '/flows/' + config.flowname + '/apps/chat/messages?count=1&after_time='+last_sent_at,
				method: 'GET',
				headers: {"Cookie": cookie}
			};
			var req2 = https.request(getMessageOptions, function(res2) {
				res2.on('data', function(d) {
					totalData = totalData + d.toString("utf8");
				});
				res2.on('end', function(){
					b = JSON.parse(totalData);
					parseMessages(b);
				});
			});
			req2.end();
	};

	var parseMessages = function (json, callback) {
		for(var i = 0; i < json.length; i++){
			var message = json[i];
			if(message.sent > last_sent_at ){
				last_sent_at = message.sent;
			}

			if (message.event != 'message'){
				return;
			}
			var match = message.content.match(/^Flowd,?\s(\w*)\s?(.*)/i);
			if(match && match.length > 1) {
        if(match[1] == 'help') {
          msg = "    Commands:\n";
          for(var cmd in availableCommands) {
            if(availableCommands.hasOwnProperty(cmd)) {
              if(availableCommands[cmd].help)
                msg += "    " + cmd + " - " + availableCommands[cmd].help + "\n";
              else
                msg += "    " + cmd + "\n";
            }
          }
          postMessage(msg);
        } else if(availableCommands[match[1]]) {
          var args = "";
          if (match.length > 2) {
            args = match[2];
          }
          availableCommands[match[1]].execute(args, postMessage);
          continue;
        } else {
          postMessage(config.syntaxErrorMessage);
        }
      }
		}
	};
	
	var postMessage = function(message){
		var postBody = {
			app: "chat",
			channel: "/flows/" +config.flowname,
			"event": "message",
			message: '"' + message.replace(/\n/g, '\\n').replace(/\r/g, '') + '"',
			"private": "false",
			tags: ""
		};
		
		var options = {
			host: config.messageHost,
			port: 443,
			path: '/messages',
			method: 'POST',
			headers: {
				"Cookie": cookie, 
				"Content-Type": "application/x-www-form-urlencoded"
			}
		};
		

		var req = https.request(options, function(res) {
			res.on('end', function(err, data) {
				if(err){
				} else if (data) {
				}
			});
			res.on('data', function(err, data) {
				if(err){
				} else if (data) {
				}
			});
		});
		req.write(querystring.stringify(postBody));
		req.end();
	};
	//this starts the whole process
	auth();
});

Flowd.start();
