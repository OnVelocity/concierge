#!/usr/bin/env node

/*

Usage:
use pm2 to start with a --kill-timeout=3000 parameter
> pm2 start doorbell.js --kill-timeout=3000

*/
var aws = require('./info.json');

var _ = require('lodash');
var os = require('os');
var awsIot = require('aws-iot-device-sdk');
var GPIO = require('onoff').Gpio;

var doorbell6 = new GPIO(6, 'in', 'both');
var doorbell22 = new GPIO(22, 'in', 'both');

var device = awsIot.device({
	keyPath: './' + aws.privateKey,
	certPath: './' + aws.clientCert,
	caPath: './' + aws.caCert,
	clientId: aws.clientId,
	region: 'us-east-1'
});

var topicPrefix = 'things/' + aws.thingName;

var TOPICS = {
	online: topicPrefix + '/online',
	offline: topicPrefix + '/offline',
	heartbeat: topicPrefix + '/heartbeat',
	healthcheck: 'healthcheck',
	doorbell: topicPrefix + '/doorbell',
	ifchange: topicPrefix + '/ifchange',
	ok: topicPrefix + '/ok',
};

var ifaces = null;
var broadcastNetworkStatusTimeoutId;

function getIPs() {
	var out = {};
	var networkInterfaces;
	try {
		networkInterfaces = os.networkInterfaces();
	} catch (error) {
		console.log('error', error);
		return {error: error};
	}
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

	var checkIfaces;

	try {
		checkIfaces = os.networkInterfaces();
	} catch (error) {
		console.log('error', error);
		checkIfaces = {error: error};
	}

	if (!_.isEqual(ifaces, checkIfaces)) {
		ifaces = checkIfaces;
		sendMessage(TOPICS.ifchange, {info: checkIfaces});
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

device.on('connect', function () {
	console.log('connect');
	device.subscribe(TOPICS.healthcheck);
	sendMessage(TOPICS.online);
	heartbeat();
	broadcastNetworkStatus();
});

device.on('message', function(topic, payload) {
	console.log('message', topic, payload.toString());
	if (topic === TOPICS.healthcheck) {
		sendMessage(TOPICS.ok, getIPs());
	}
});

// sendMessage
function sendMessage(topic, info) {

	var data = {
		timestamp: (new Date()).toISOString()
	};

	if (info) {
		// make sure info is parsable before assigning it
		try {
			dataString = JSON.stringify(info);
		} catch (error) {
			console.log('error', error);
			info = error;
		}
		_.assign(data, info);
	}

	console.log(topic);
	device.publish(topic, JSON.stringify(data));

}

// heartbeat
var heartbeatTimeoutId;
function heartbeat() {
	clearTimeout(heartbeatTimeoutId);
	sendMessage(TOPICS.heartbeat);
	heartbeatTimeoutId = setTimeout(heartbeat, 1 * 60 * 60 * 1000);
}

// hardware switch logic
function doorbellRinging(home, err, state) {
	// 1 == pressed, 0 == not pressed
	var topic = TOPICS.doorbell.replace(aws.thingName, home);
	if (state == 1) {
		console.log('doorbell is ringing');
		sendMessage(topic, {isRinging: 1, doorName: aws.thingName});
	} else {
		console.log('doorbell is not ringing');
		sendMessage(topic, {isRinging: 0, doorName: aws.thingName});
	}
}


// TODO how do we auto discover / configure button to home unit logic?
doorbell6.watch(doorbellRinging.bind(null, 'home-button-test-2'));
doorbell22.watch(doorbellRinging.bind(null, 'home-button-test'));


// Process Interrupt
process.on('SIGINT', function () {

	doorbell6.unexport();
	doorbell22.unexport();

	clearTimeout(broadcastNetworkStatusTimeoutId);
	clearTimeout(heartbeatTimeoutId);

	sendMessage(TOPICS.offline);

	setTimeout(function () {
		process.exit(0);
	}, 300);

});
