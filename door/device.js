var awsIot = require('aws-iot-device-sdk');

var key = ['group1', 'c2d83e036b780b21ebe76e4aa7bbc55f'];

var name = 'ov-door-0';

var identity = {
	keyPath: './ssh/' + key[1] + '.key',
	certPath: './ssh/' + key[1] + '.crt',
	caPath: './ssh/root.crt',
	clientId: key[1] + '-door',
	region: 'us-east-1'
};

var TOPICS = {
	// group/device/lock
	LOCK: key.concat('lock').join('/'),
	// group/device/unlock
	UNLOCK: key.concat('unlock').join('/')
};

// TODO get state from sensors
var state = {
	open: 0, 	// determine if door is open or not
	locked: 1 	// determine if door is locked or not
};

var thingShadow = awsIot.thingShadow(identity);

// TODO use this token to validate updates succeeded or rejected
var clientTokenUpdate;

function reportState() {
	clientTokenUpdate = thingShadow.update(name,  {"state": {"reported": state}});
	console.log('update client token', clientTokenUpdate);
	if (clientTokenUpdate === null) {
		console.log('update shadow failed, operation still in progress');
	}
}

function unlockDoor() {
	state.locked = 0;
	lockDoorAfterTimeout(8000);
	reportState();
}

function lockDoor() {
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

thingShadow.on('connect',
	function onConnect() {

		console.log('connect door', key[1]);

		thingShadow.register(name);

		//
		// Note that the delay is not required for subsequent updates; only
		// the first update after a Thing Shadow registration using default
		// parameters requires a delay.  See API documentation for the update
		// method for more details.
		//

		thingShadow.subscribe(TOPICS.LOCK);
		thingShadow.subscribe(TOPICS.UNLOCK);

		setTimeout(reportState, 5000);

	});

thingShadow.on('status',
	function onStatus(thingName, stat, clientToken, stateObject) {
		console.log(clientToken, 'received ' + stat + ' on ' + thingName + ': ' + JSON.stringify(stateObject));
	});

thingShadow.on('delta',
	function onDelta(thingName, stateObject) {
		console.log('received delta on ' + thingName + ': ' + JSON.stringify(stateObject));
	});

thingShadow.on('timeout',
	function (thingName, clientToken) {
		console.log(clientToken, 'received timeout on ' + thingName + ' with token: ' + clientToken);
	});

thingShadow.on('message',
	function (topic, payload) {
		console.log('message', topic, payload.toString());
		if (topic === TOPICS.LOCK) {
			lockDoor();
		} else if (topic === TOPICS.UNLOCK) {
			unlockDoor();
		}
	});
