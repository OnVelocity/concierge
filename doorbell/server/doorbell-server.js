#!/usr/bin/env node

/*

 Usage:
 use pm2 to start with a --kill-timeout=3000 parameter
 > pm2 start doorbell.js --kill-timeout=3000

 */
var aws = require('../info.json');

var _ = require('lodash');
var os = require('os');
var awsIot = require('aws-iot-device-sdk');
var GPIO = require('onoff').Gpio;

var doorbell6 = new GPIO(6, 'in', 'both');
var doorbell22 = new GPIO(22, 'in', 'both');
var lock17 = new GPIO(17, 'out');

var device = awsIot.device({
	keyPath: '../' + aws.privateKey,
	certPath: '../' + aws.clientCert,
	caPath: '../' + aws.caCert,
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
	grantentry: topicPrefix + '/grantentry',
	lockdoorerr: topicPrefix + '/lockdoor/e',
	lockdoorok: topicPrefix + '/lockdoor/ok'
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
	device.subscribe(TOPICS.grantentry);
	sendMessage(TOPICS.online);
	heartbeat();
	broadcastNetworkStatus();
});

device.on('message', function(topic, payload) {
	console.log('message', topic, payload.toString());
	if (topic === TOPICS.healthcheck) {
		sendMessage(TOPICS.ok, getIPs());
	}
	if (topic === TOPICS.grantentry) {
		var data = parseJson(payload.toString());
		unlockDoor(data.home);
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
		sendMessage(topic, {isRinging: 1, door: aws.thingName});
	} else {
		console.log('doorbell is not ringing');
		sendMessage(topic, {isRinging: 0, door: aws.thingName});
	}
}

var unlockDoorTimeoutId;
function lockDoor(home) {
	console.log('lock door');
	lock17.write(0, function (err) {
		if (err) {
			sendMessage(TOPICS.lockdoorerr.replace(aws.thingName, home), {info: err});
		} else {
			sendMessage(TOPICS.lockdoorok.replace(aws.thingName, home));
		}
	});
}
function unlockDoor(home) {
	console.log('unlock door');
	lock17.write(1, function (err) {
		var topic = TOPICS.grantentry.replace(aws.thingName, home);
		if (err) {
			sendMessage(topic + '/e', {info: err});
		} else {
			sendMessage(topic + '/ok');
		}
	});
	clearTimeout(unlockDoorTimeoutId);
	unlockDoorTimeoutId = setTimeout(lockDoor.bind(null, home), 3 * 1000);
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

function parseJson(jsonString) {
	try {
		return JSON.parse(jsonString || '{}');
	} catch (ignore) {}
	return {};
}
