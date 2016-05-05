# home
the end point enabled to open the door

fix this asap
home-server-0 (err): (node) warning: possible EventEmitter memory leak detected. 11 connection listeners added. Use emitter.setMaxListeners() to increase limit.
home-server-0 (err): Trace
home-server-0 (err):     at Namespace.addListener (events.js:179:15)
home-server-0 (err):     at Server.(anonymous function) [as on] (/home/pi/server/node_modules/socket.io/lib/index.js:369:16)
home-server-0 (err):     at DeviceClient.<anonymous> (/home/pi/server/home-server.js:142:5)
home-server-0 (err):     at DeviceClient.emit (events.js:104:17)
home-server-0 (err):     at MqttClient.<anonymous> (/home/pi/server/node_modules/aws-iot-device-sdk/device/index.js:569:12)
home-server-0 (err):     at MqttClient.emit (events.js:129:20)
home-server-0 (err):     at MqttClient._handleConnack (/home/pi/server/node_modules/aws-iot-device-sdk/node_modules/mqtt/lib/client.js:695:10)
home-server-0 (err):     at MqttClient._handlePacket (/home/pi/server/node_modules/aws-iot-device-sdk/node_modules/mqtt/lib/client.js:282:12)
home-server-0 (err):     at process (/home/pi/server/node_modules/aws-iot-device-sdk/node_modules/mqtt/lib/client.js:226:12)
home-server-0 (err):     at Writable.writable._write (/home/pi/server/node_modules/aws-iot-device-sdk/node_modules/mqtt/lib/client.js:236:5)
home-server-0 (err): Error: write EPROTO 1996386832:error:14094416:SSL routines:SSL3_READ_BYTES:sslv3 alert certificate unknown:../deps/openssl/openssl/ssl/s3_pkt.c:1300:SSL alert number 46
home-server-0 (err): 
home-server-0 (err):     at exports._errnoException (util.js:746:11)
home-server-0 (err):     at WriteWrap.afterWrite (net.js:775:14)
home-server-0 (err): Error: write EPROTO 1996165648:error:14094416:SSL routines:SSL3_READ_BYTES:sslv3 alert certificate unknown:../deps/openssl/openssl/ssl/s3_pkt.c:1300:SSL alert number 46
home-server-0 (err): 
home-server-0 (err):     at exports._errnoException (util.js:746:11)
home-server-0 (err):     at WriteWrap.afterWrite (net.js:775:14)

