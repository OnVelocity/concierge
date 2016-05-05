#!/usr/bin/env node

/*

Usage:
use pm2 to start with a --kill-timeout=3000 parameter
> pm2 start home.js --kill-timeout=3000

*/

var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');

app.listen(8030);

function handler (req, res) {
	fs.readFile(__dirname + '/public/index.html',
		function (err, data) {
			if (err) {
				res.writeHead(500);
				return res.end('Error loading index.html');
			}

			res.writeHead(200);
			res.end(data);
		});
}

var aws = require('./info.json');

var _ = require('lodash');
var os = require('os');
var GPIO = require('onoff').Gpio;

var doorbell = new GPIO(4, 'out');

var awsIot = require('aws-iot-device-sdk');

var device = awsIot.device({
	keyPath: './' + aws.privateKey,
	certPath: './' + aws.clientCert,
	caPath: './' + aws.caCert,
	clientId: aws.clientId,
	region: 'us-east-1'
});

var topicPrefix = 'things/' + aws.thingName;

var TOPICS = {
	// health related message topics
	online: topicPrefix + '/online',
	offline: topicPrefix + '/offline',
	heartbeat: topicPrefix + '/heartbeat',
	healthcheck: 'healthcheck',
	ifchange: topicPrefix + '/ifchange',
	ok: topicPrefix + '/ok',
	// door related message topics
	doorbell: topicPrefix + '/doorbell',
	hangup: topicPrefix + '/hangup',
	grantentry: topicPrefix + '/grantentry'
};

var ifaces = null;
var broadcastNetworkStatusTimeoutId;

function getIPs() {
	var out = {};
	var networkInterfaces = os.networkInterfaces();
	Object.keys(networkInterfaces).forEach(function (ifname) {
		var alias = 0;
		networkInterfaces[ifname].forEach(function (iface) {
			if ('IPv4' === iface.family && !iface.internal) {
				out[ifname + alias] = iface.address;
			}
			++alias;
		});
	});
	return out;
}

function broadcastNetworkStatus() {

	clearTimeout(broadcastNetworkStatusTimeoutId);

	var checkIfaces = os.networkInterfaces();

	if (!_.isEqual(ifaces, checkIfaces)) {
		ifaces = checkIfaces;
		sendMessage(TOPICS.ifchange, {ifaces: checkIfaces});
		Object.keys(checkIfaces).forEach(function (ifname) {
			var alias = 0;
			checkIfaces[ifname].forEach(function (iface) {
				if ('IPv4' === iface.family && !iface.internal) {
					if (alias >= 1) {
						console.log(ifname + ':' + alias, iface.address);
					} else {
						console.log(ifname, iface.address);
					}
				}
				++alias;
			});
		});
	}

	broadcastNetworkStatusTimeoutId = setTimeout(broadcastNetworkStatus, 10 * 1000);

}

var toggleDoorbellRingingTimeoutId;
function toggleDoorbellRinging() {
	console.log('toggleDoorbellRinging');
	doorbell.writeSync(1);
	doorbell.read(function (err, value) {
		if (value) {
			sendMessage(TOPICS.doorbell + '/ok');
		} else {
			sendMessage(TOPICS.doorbell + '/e', {info: err});
		}
	});
	clearTimeout(toggleDoorbellRingingTimeoutId);
	// ring doorbell sound for 3 seconds after last messages
	toggleDoorbellRingingTimeoutId = setTimeout(function () {
		doorbell.write(0);
	}, 3 * 1000);
}

var doorToUnlockInfo = null;

device.on('connect', function () {

	console.log('connect');

	device.subscribe(TOPICS.healthcheck);
	device.subscribe(TOPICS.doorbell);

	sendMessage(TOPICS.online);
	heartbeat();
	broadcastNetworkStatus();

	io.on('connection', function (socket) {
		sendMessage(TOPICS.online);
		socket.on('answerBtn', function (data) {
			console.log(data);
			// TODO enable microphone
		});
		socket.on('hangupBtn', function (data) {
			console.log(data);
			// TODO close webRTC connection
			if (doorToUnlockInfo) {
				sendMessage(TOPICS.hangup);
			}
		});
		socket.on('grantEntry', function (data) {
			console.log(data);
			if (doorToUnlockInfo) {
				var topic = TOPICS.grantentry.replace(aws.thingName, doorToUnlockInfo.doorName);
				sendMessage(topic);
			}
		});
	});

});

device.on('message', function(topic, payload) {

	console.log('message', topic, payload.toString());

	if (topic === TOPICS.healthcheck) {
		sendMessage(TOPICS.ok, getIPs());
	}

	if (topic === TOPICS.doorbell) {

		toggleDoorbellRinging();
		var data = parseJson(payload.toString());
		io.emit('doorbell is ringing', data);
		doorToUnlockInfo = data;

	}

});

// sendMessage
function sendMessage(topic, info) {
	var data = {
		timestamp: (new Date()).toISOString()
	};
	if (info) {
		_.assign(data, info);
	}
	device.publish(topic, JSON.stringify(data));
}

function parseJson(jsonString) {
	try {
		return JSON.parse(jsonString || '{}');
	} catch (ignore) {}
	return {};
}

// heartbeat
var heartbeatTimeoutId;
function heartbeat() {
	clearTimeout(heartbeatTimeoutId);
	sendMessage(TOPICS.heartbeat);
	heartbeatTimeoutId = setTimeout(heartbeat, 1 * 60 * 60 * 1000);
}

// Process Interrupt
process.on('SIGINT', function () {

	doorbell.unexport();

	clearTimeout(broadcastNetworkStatusTimeoutId);
	clearTimeout(heartbeatTimeoutId);

	sendMessage(TOPICS.offline);

	setTimeout(function () {
		process.exit(0);
	}, 300);

});
