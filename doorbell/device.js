var awsIot = require('aws-iot-device-sdk');

// TODO key is comprised of two UIDs (group and device)
var key = ['group1', '43971af6b9ded8a65f0f491cb544f035'];

var name = 'ov-doorbell-0';

var identity = {
	keyPath: './ssh/' + key[1] + '.key',
	certPath: './ssh/' + key[1] + '.crt',
	caPath: './ssh/root.crt',
	clientId: key[1] + '-doorbell',
	region: 'us-east-1'
};

var TOPICS = {
	// group/device/announce/home
	/**
	 * @return {string}
	 */
	ANNOUNCE: function (home) {
		return key.concat('announce', home).join('/');
	}
};

var state = {
	announce: 0, // the selected bell number to ring
	isDoorOpen: 0 // illuminate door open led
};

var thingShadow = awsIot.thingShadow(identity);

var clientTokenUpdate;

function reportState() {
	clientTokenUpdate = thingShadow.update(name, {"state": {"reported": state}});
	console.log('update client token', clientTokenUpdate);
	if (clientTokenUpdate === null) {
		console.log('update shadow failed, operation still in progress');
	}
}

function announce() {
	state.locked = 1;
	reportState();
}

var lockDoorAfterTimeout_timeout;
function lockDoorAfterTimeout(timeInMs) {
	clearTimeout(lockDoorAfterTimeout_timeout);
	lockDoorAfterTimeout_timeout = setTimeout(function () {
		lockDoor();
	}, timeInMs || 5000);
}

thingShadow.on('connect', function () {

	thingShadow.register(name);
	//
	// 5 seconds after registering, update the Thing Shadow named
	// 'RGBLedLamp' with the latest device state and save the clientToken
	// so that we can correlate it with status or timeout events.
	//
	// Note that the delay is not required for subsequent updates; only
	// the first update after a Thing Shadow registration using default
	// parameters requires a delay.  See API documentation for the update
	// method for more details.
	//
	console.log('connect door', key[1]);
	thingShadow.subscribe(TOPICS.LOCK);
	thingShadow.subscribe(TOPICS.UNLOCK);
	thingShadow.publish(TOPICS.STATUS, JSON.stringify({connected: 1, open: state.open, locked: state.locked}));
	setTimeout(reportState, 5000);
});

thingShadow.on('status',
	function (thingName, stat, clientToken, stateObject) {
		console.log('status client token', clientToken);
		console.log('received ' + stat + ' on ' + thingName + ': ' +
			JSON.stringify(stateObject));
	});

thingShadow.on('delta',
	function (thingName, stateObject) {
		console.log('received delta on ' + thingName + ': ' +
			JSON.stringify(stateObject));
	});

thingShadow.on('timeout',
	function (thingName, clientToken) {
		console.log('timeout client token', clientToken);
		console.log('received timeout on ' + thingName + ' with token: ' + clientToken);
	});

thingShadow.on('message', function (topic, payload) {
	console.log('message', topic, payload.toString());
	if (topic === TOPICS.LOCK) {
		lockDoor();
	} else if (topic === TOPICS.UNLOCK) {
		state.locked = 0;
		lockDoorAfterTimeout(8000);
		reportState();
	}
});
