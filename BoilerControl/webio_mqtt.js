/*
 * Boiler control - MQTT over WebSockets client
 *
 * Endpoint comes from ../common/config.js (Cloudflare Tunnel hostname).
 * Credentials are asked for once by ../common/auth.js and kept in this
 * browser's localStorage - nothing sensitive lives in this file.
 */
var subscription = "heater/#";
var clientId = "boiler_ui_" + Math.random().toString(16).slice(2, 10);

// Constructed but not connected: Paho only dials out on connect().
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

// Paho 1.0.1 reports a CONNACK refusal as errorCode 6 ("Bad Connack return
// code:5"), not as 4/5, so match on both the code and the message.
function isAuthFailure(res) {
    if (!res) return false;
    if (res.errorCode === 4 || res.errorCode === 5 || res.errorCode === 6) return true;
    return /return code:5|not authori[sz]ed/i.test(res.errorMessage || "");
}

SmartHomeAuth.require(function (creds) {
    brokerCreds = creds;
    Connect();
});

/*Initiates a connection to the MQTT broker*/
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

/*Callback for successful MQTT connection */
function Connected() {
    console.log("Connected!");
    authFailures = 0;
    mqttClient.subscribe(subscription);
    // Send state update request to remote server
    requestStateUpdate();
}

/*Callback for failed connection*/
function ConnectionFailed(res) {
    console.log("Connect failed: errorCode=" + res.errorCode + " " + res.errorMessage);

    // CONNACK 4/5 (Paho reports a CONNACK 5 as errorCode 6)
    if (isAuthFailure(res)) {
        reauth("The broker rejected that user/password. The user is 'webui', not an email address.");
        return;
    }
    if (noteFailure("Could not connect to the broker. Check the network and the login, then try again.")) return;
    retryTimer = setTimeout(Connect, 5000);
}

/*Callback for lost connection*/
function ConnectionLost(res) {
    if (res.errorCode == 0) return;
    console.log("Connection lost: errorCode=" + res.errorCode + " " + res.errorMessage);

    // A broker rejection can arrive here rather than in onFailure
    if (isAuthFailure(res)) {
        reauth("The broker rejected that user/password. The user is 'webui', not an email address.");
        return;
    }
    if (noteFailure("Repeated disconnects. Check the broker login, then try again.")) return;
    retryTimer = setTimeout(Connect, 5000);
}

/* Callback for incoming message processing */
function MessageArrived(message) {
	console.log(message.destinationName +" : " + message.payloadString);	
	var topic = message.destinationName.split("/");
	if (topic.length == 3 && topic[1] == "status"){
		var dest = topic[2];
		switch(dest){
		case "temp":
			setCurrentTempValue(parseInt(message.payloadString));
			break;
		case "log":
			logAppend(message.payloadString);
			break;
		case "logClear":
			logClear();
			break;
		case "heating":
			setHeatingActive(parseInt(message.payloadString) == 1);
			break;
		case "current":
			setCurrent(parseInt(message.payloadString) == 1);
			break;
		case "deactivate":
			deactivateProgram(message.payloadString);
			break;
		case "settings":
			restoreSettings(message.payloadString);
			break;
		case "targetTemp":
			// Delegate to UI helper which will record the target and show marker only when heating is active
			try {
				var tgt = parseFloat(message.payloadString);
				if (!isNaN(tgt) && window.setTargetTemp) {
					window.setTargetTemp(tgt);
				}
			} catch (e) { console.error('targetTemp handler error', e); }
			break;
		}
	}
}

function requestStateUpdate() {
	var message = new Paho.MQTT.Message("update");
	message.destinationName = "heater/command/state";
	mqttClient.send(message);    
}
