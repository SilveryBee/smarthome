/* 
 * MQTT-WebClient example for Web-IO 4.0
*/
var hostname = "542eae39098649348d20f0029dc1ac86.s1.eu.hivemq.cloud";
var port = 8884;
var clientId = "542eae39098649348d20f0029dc1ac86";
clientId += new Date().getUTCMilliseconds();;
var username = "polaris";
var password = "84jdF8fGF95";
var subscription = "heater/#";

mqttClient = new Paho.MQTT.Client(hostname, port, clientId);
mqttClient.onMessageArrived =  MessageArrived;
mqttClient.onConnectionLost = ConnectionLost;
Connect();

/*Initiates a connection to the MQTT broker*/
function Connect(){
	mqttClient.connect({
		onSuccess: Connected,
		onFailure: ConnectionFailed,
		keepAliveInterval: 10,
		userName: username,
		useSSL: true,
		password: password	
	});
}

/*Callback for successful MQTT connection */
function Connected() {
  console.log("Connected!");
  mqttClient.subscribe(subscription);
  // Send state update request to remote server
  requestStateUpdate();
}

/*Callback for failed connection*/
function ConnectionFailed(res) {
	console.log("Connect failed:" + res.errorMessage);
}

/*Callback for lost connection*/
function ConnectionLost(res) {
  if (res.errorCode != 0) {
	console.log("Connection lost:" + res.errorMessage);
	Connect();
  }
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
		}
	}
}



