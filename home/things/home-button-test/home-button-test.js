
var _ = require('lodash');
var os = require('os');
var GPIO = require('onoff').Gpio;

var doorbell = new GPIO(4, 'out');

var awsIot = require('aws-iot-device-sdk');

var aws = require('./info.json');

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

device.on('connect', function () {
	console.log('connect');
	device.subscribe(TOPICS.healthcheck);
	device.subscribe(TOPICS.doorbell);
	sendMessage(TOPICS.online);
	heartbeat();
	broadcastNetworkStatus();
});

device.on('message', function(topic, payload) {
	console.log('message', topic, payload.toString());
	if (topic === TOPICS.healthcheck) {
		sendMessage(TOPICS.ok, getIPs());
	}
	if (topic === TOPICS.doorbell) {
		toggleDoorbellRinging();
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
