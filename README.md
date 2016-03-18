# concierge
door in the cloud

# Stories
The story is simple, create a cloud-based gate entry system.

## Epic: network connection support
1. make the wifi connection robust
2. implement gsm connection
3. configure wifi pragmatically
4. support multiple wifi connections
5. auto-connect to available wifi or fail over to gsm
6. configure wifi from secure user interface

## Epic: lock features
1. detect lock state from physical door
2. unlock door by controlling the lock relay
3. detect the door open state from physical door
4. lock door by controlling the lock relay

## Epic: doorbell features
1. show list of homes
2. announce guest for one of the homes in the list
3. play ring sound when button pressed
4. create private video room in janus gateway for video and voice
5. configure list of homes from secure user interface

## Epic: home features
1. play sound when doorbell announces guest
2. see video of guest at doorbell
3. push button to talk to guest
4. push button to unlock door so guest can enter

