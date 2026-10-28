/* 
 * PondManager MQTT Communication Handler
 * Connects to MQTT broker and handles message routing
 */

// MQTT Configuration
// Endpoint: ../common/config.js   Credentials: ../common/auth.js (prompted once)
var subscription = "pondmanager/#";
var clientId = "pondmanager_ui_" + Math.random().toString(16).slice(2, 10);

// Create MQTT client (constructed but not connected until credentials exist)
var mqttClient = new Paho.MQTT.Client(
    MQTT_CONFIG.host, MQTT_CONFIG.port, MQTT_CONFIG.path, clientId);
mqttClient.onMessageArrived = MessageArrived;
mqttClient.onConnectionLost = ConnectionLost;

var brokerCreds = null;
var retryTimer = null;
var authFailures = 0;

// Ask for the login again. Used when the broker rejects the saved credentials,
// and after repeated failures - e.g. the password was rotated in Mosquitto.
function reauth(message) {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    SmartHomeAuth.forget();
    brokerCreds = null;
    SmartHomeAuth.require(function (creds) {
        brokerCreds = creds;
        Connect();
    }, message);
}

function noteFailure(message) {
    authFailures++;
    if (authFailures >= 3) {
        reauth(message);
        return true;
    }
    return false;
}

// Ask for credentials once, then connect
SmartHomeAuth.require(function (creds) {
    brokerCreds = creds;
    Connect();
});

// Automatically refresh state when switching back to this tab
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        if (mqttClient && mqttClient.isConnected()) {
            console.log("Tab visible: requesting state update");
            requestStateUpdate();
        } else {
            console.log("Tab visible: reconnecting MQTT");
            Connect();
        }
    }
});

/**
 * Initiates a connection to the MQTT broker
 */
function Connect() {
    if (!brokerCreds || mqttClient.isConnected()) return;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }

    mqttClient.connect({
        onSuccess: Connected,
        onFailure: ConnectionFailed,
        keepAliveInterval: 60,
        userName: brokerCreds.user,
        password: brokerCreds.pass,
        useSSL: MQTT_CONFIG.useSSL,
        cleanSession: true,
        timeout: 10
    });
}

/**
 * Callback for successful MQTT connection
 */
function Connected() {
    console.log("Connected to MQTT broker!");
    authFailures = 0;
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
    console.log("Connection failed: errorCode=" + res.errorCode + " " + res.errorMessage);
    if (window.setOnlineStatus) {
        window.setOnlineStatus(false);
    }

    // 4 = bad username/password, 5 = not authorised
    if (res.errorCode === 4 || res.errorCode === 5) {
        reauth("The broker rejected that user/password. The user is 'webui', not an email address.");
        return;
    }
    if (noteFailure("Could not connect to the broker. Check the network and the login, then try again.")) return;
    retryTimer = setTimeout(Connect, 5000);
}

/**
 * Callback for lost connection
 */
function ConnectionLost(res) {
    if (res.errorCode == 0) return;
    console.log("Connection lost: errorCode=" + res.errorCode + " " + res.errorMessage);
    if (window.setOnlineStatus) {
        window.setOnlineStatus(false);
    }

    // A broker rejection can arrive here rather than in onFailure
    if (res.errorCode === 4 || res.errorCode === 5) {
        reauth("The broker rejected that user/password. The user is 'webui', not an email address.");
        return;
    }
    if (noteFailure("Repeated disconnects. Check the broker login, then try again.")) return;
    retryTimer = setTimeout(Connect, 5000);
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

            case "command":
            case "test":
                // Outgoing/test messages received on wildcard subscription - ignore silently
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
function sendWaterInterval(minutes) {
    if (!mqttClient.isConnected()) {
        console.error("MQTT not connected");
        if (window.logAppend) window.logAppend("ERROR: MQTT not connected");
        return;
    }
    var payload = JSON.stringify({ waterInterval: parseInt(minutes) });
    var message = new Paho.MQTT.Message(payload);
    message.destinationName = "pondmanager/command";
    mqttClient.send(message);
    if (window.logAppend) window.logAppend("Water check interval set: " + minutes + " min");
}

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
