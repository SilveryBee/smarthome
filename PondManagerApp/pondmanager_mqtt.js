/* 
 * PondManager MQTT Communication Handler
 * Connects to MQTT broker and handles message routing
 */

// MQTT Configuration
var hostname = "542eae39098649348d20f0029dc1ac86.s1.eu.hivemq.cloud";
var port = 8884;
var clientId = "pondmanager_" + new Date().getUTCMilliseconds();
var username = "polaris";
var password = "84jdF8fGF95";
var subscription = "pondmanager/#";

// Create MQTT client
mqttClient = new Paho.MQTT.Client(hostname, port, clientId);
mqttClient.onMessageArrived = MessageArrived;
mqttClient.onConnectionLost = ConnectionLost;

// Connect on page load
Connect();

/**
 * Initiates a connection to the MQTT broker
 */
function Connect() {
    mqttClient.connect({
        onSuccess: Connected,
        onFailure: ConnectionFailed,
        keepAliveInterval: 10,
        userName: username,
        useSSL: true,
        password: password
    });
}

/**
 * Callback for successful MQTT connection
 */
function Connected() {
    console.log("Connected to MQTT broker!");
    mqttClient.subscribe(subscription);
    
    // Update UI status
    if (window.setOnlineStatus) {
        window.setOnlineStatus(true);
    }
    
    // Request state update from ESP
    requestStateUpdate();
}

/**
 * Callback for failed connection
 */
function ConnectionFailed(res) {
    console.log("Connection failed: " + res.errorMessage + ". Retrying in 5s...");
    if (window.setOnlineStatus) {
        window.setOnlineStatus(false);
    }
    setTimeout(Connect, 5000);
}

/**
 * Callback for lost connection
 */
function ConnectionLost(res) {
    if (res.errorCode != 0) {
        console.log("Connection lost: " + res.errorMessage);
        if (window.setOnlineStatus) {
            window.setOnlineStatus(false);
        }
        // Attempt reconnection
        setTimeout(Connect, 5000);
    }
}

/**
 * Callback for incoming MQTT messages
 * Routes messages to appropriate UI handlers
 */
function MessageArrived(message) {
    console.log(message.destinationName + " : " + message.payloadString);
    
    var topic = message.destinationName.split("/");
    
    // Expected topic structure: pondmanager/state or pondmanager/log
    if (topic.length >= 2 && topic[0] == "pondmanager") {
        var dest = topic[1];
        
        switch(dest) {
            case "state":
                // Parse JSON state update
                try {
                    var state = JSON.parse(message.payloadString);
                    if (window.updatePondState) {
                        window.updatePondState(state);
                    }
                } catch (e) {
                    console.error("Failed to parse state JSON:", e);
                }
                break;
                
            case "log":
                // Append to event log
                if (window.logAppend) {
                    window.logAppend(message.payloadString);
                }
                break;
                
            case "error":
                // Handle error messages
                if (window.logAppend) {
                    window.logAppend("ERROR: " + message.payloadString);
                }
                break;
                
            default:
                console.log("Unknown topic destination:", dest);
        }
    }
}

/**
 * Request state update from ESP
 */
function requestStateUpdate() {
    var message = new Paho.MQTT.Message("update");
    message.destinationName = "pondmanager/command/state";
    mqttClient.send(message);
    console.log("Requested state update");
}

/**
 * Send valve command to ESP
 * @param {string} command - "open" or "close"
 */
function sendValveCommand(command) {
    if (!mqttClient.isConnected()) {
        console.error("MQTT not connected");
        if (window.logAppend) {
            window.logAppend("ERROR: MQTT not connected");
        }
        return;
    }
    
    var payload = JSON.stringify({ valve: command });
    var message = new Paho.MQTT.Message(payload);
    message.destinationName = "pondmanager/command";
    mqttClient.send(message);
    console.log("Sent valve command:", command);
    
    if (window.logAppend) {
        window.logAppend("Valve command sent: " + command);
    }
}

/**
 * Send desired water level to ESP
 * @param {number} level - Desired water level as distance in cm (5-70)
 */
function sendDesiredLevel(level) {
    if (!mqttClient.isConnected()) {
        console.error("MQTT not connected");
        return;
    }
    
    var payload = JSON.stringify({ desiredLevel: level });
    var message = new Paho.MQTT.Message(payload);
    message.destinationName = "pondmanager/command";
    mqttClient.send(message);
    console.log("Sent desired level:", level);
    
    if (window.logAppend) {
        window.logAppend("Desired level set: " + level + " cm");
    }
}

/**
 * Send waterfall valve command to ESP
 * @param {string} command - "open" or "close"
 */
function sendWaterfallCommand(command) {
    if (!mqttClient.isConnected()) {
        console.error("MQTT not connected");
        if (window.logAppend) {
            window.logAppend("ERROR: MQTT not connected");
        }
        return;
    }

    var payload = JSON.stringify({ waterfall: command });
    var message = new Paho.MQTT.Message(payload);
    message.destinationName = "pondmanager/command";
    mqttClient.send(message);
    console.log("Sent waterfall command:", command);

    if (window.logAppend) {
        window.logAppend("Waterfall command sent: " + command);
    }
}

/**
 * Send reset command to ESP
 */
function sendResetCommand() {
    if (!mqttClient.isConnected()) {
        console.error("MQTT not connected");
        if (window.logAppend) {
            window.logAppend("ERROR: MQTT not connected");
        }
        return;
    }

    var payload = JSON.stringify({ reset: true });
    var message = new Paho.MQTT.Message(payload);
    message.destinationName = "pondmanager/command";
    mqttClient.send(message);
    console.log("Sent reset command");

    if (window.logAppend) {
        window.logAppend("Reset command sent");
    }
}
