
//======================================================================================
var tempProg = null;
var tempVal = null;
var tempTimeOut = null;

var timeProg = null;
var timeHour = null;
var timeMinute = null;
var timeTimeOut = null;
//-------------------------------------------------------------------
function timeChanged(timePicker) {
	if (timeTimeOut != null) {
		clearTimeout(timeTimeOut);
	}
	var index = timePicker.name.match(/\w+(\d+)/);
	console.log("Time changed for prog#" + index[1]);
	time = parseTime(timePicker.value)
	timeProg = index[1];
	hourVal = time.getHours();
	minuteVal = time.getMinutes();
	timeTimeOut = setTimeout(sendTime, 1000);
}
//-------------------------------------------------------------------
function parseTime( t ) {
	   var d = new Date();
	   var time = t.match( /(\d+)(?::(\d\d))?\s*(..)/ );
	   d.setHours( parseInt( time[1]) + (time[3] == "PM" ? 12 : 0) );
	   d.setMinutes( parseInt( time[2]) || 0 );
	   return d;
}
//-------------------------------------------------------------------
function sendTime() {
	console.log("Send time " + hourVal + ":" + minuteVal + " for prog " + tempProg);
	var message = new Paho.MQTT.Message("Time");
	
	var ms = new Uint8Array([timeProg, hourVal, minuteVal]);
	var message = new Paho.MQTT.Message(ms);
	message.destinationName = "heater/command/setstart";
	mqttClient.send(message);
	
	timeTimeOut = null;
}
//-------------------------------------------------------------------
function tempChanged(input) {
	if (tempTimeOut != null) {
		clearTimeout(tempTimeOut);
	}
	var index = input.name.match(/\w+(\d+)/);
	console.log("Temp changed for prog#" + index[1]);
	console.log(input.value);
	tempProg = index[1];
	tempVal = input.value;
	tempTimeOut = setTimeout(sendTemp, 1000);
}
//-------------------------------------------------------------------
function sendTemp() {
	console.log("Send temp " + tempVal + " for prog " + tempProg);
	var message = new Paho.MQTT.Message("Temp");
	
	var ms = new Uint8Array([tempProg, tempVal]);
	var message = new Paho.MQTT.Message(ms);
	message.destinationName = "heater/command/settemp";
	mqttClient.send(message);
	
	tempTimeOut = null;
}
// -------------------------------------------------------------------
function progActivationClicked(btn) {
	// State button clicked
	setStateButton(btn);
	
	// Parse name
	var p = btn.name.match(/(\w+)(\d+)/);
	console.log("Prog#" + p[2] + " changed to " + p[1]);
	progId = p[2] - '0';
	progState = 1;
	if (p[1] == "off") {
		progState = 1;
	}
	else if (p[1] == "on") {
		progState = 2;
	}
	else if (p[1] == "once") {
		progState = 3;
	}
	
	var message = new Paho.MQTT.Message("State");
	var ms = new Uint8Array([progId, progState]);
	var message = new Paho.MQTT.Message(ms);
	message.destinationName = "heater/command/activate";
	mqttClient.send(message);
}
//-------------------------------------------------------------------
function setCurrentTempValue(value) {
	gauge = document.querySelector(".gauge");
	
	gauge.querySelector(".gauge__fill").style.transform = `rotate(${
	  (value/200)
	}turn)`;
	gauge.querySelector(".gauge__cover").textContent = `${(value)}º`;
}

function setHeatingActive(value) {
	gauge = document.querySelector(".gauge");
	if (value) {
		gauge.querySelector(".gauge__fill").style.background="#FF0000";
	}
	else {
		gauge.querySelector(".gauge__fill").style.background="#0000FF";
	}
}

function logAppend(text) {
	const logWindow = document.getElementById('LogWindow');
	logWindow.append(text);
	br = document.createElement("br")
	logWindow.append(br);
}

function logClear() {
	const logWindow = document.getElementById('LogWindow');
	logWindow.innerHTML = "";
}

function setCurrent(value) {
	console.log("setCurrent() " + value)
}

function deactivateProgram(id) {
	console.log("deactivate prog# " + id);
	(document.getElementsByName('off' + id)[0]).className = "btn btn-primary";
	(document.getElementsByName('on' + id)[0]).className = "btn btn-default";
	(document.getElementsByName('once' + id)[0]).className = "btn btn-default";
}

function restoreSettings(buffer) {
	const settings = JSON.parse(buffer);
	console.log("Settings programs: " + settings.progCount);
	
	console.log(settings["programs"]);
	console.log(settings["programs"][0]);
	console.log(settings["programs"][0]["hour"]);
	
	
	for (i = 1; i <= settings.progCount; i++){
		// Set time
		var d = new Date();
		d.setHours(settings["programs"][i-1]["hour"]);
		d.setMinutes(settings["programs"][i-1]["min"]);
		(document.getElementsByName('time' + i))[0].value = d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
		
		// Set temp
		(document.getElementsByName('temp' + i))[0].value = settings["programs"][i-1]["temp"];
		
		// Set state
		btnName = settings["programs"][i-1]["state"];
		btn = (document.getElementsByName(btnName + i))[0];
		console.log("Setting state for button " + i + " : " + btn);
		setStateButton(btn);	
	}
	// Restore immidiate program temp
	(document.getElementsByName('temp4'))[0].value = settings["programs"][settings.progCount]["temp"];
}

function setStateButton(btn) {
	// Activation status
	buttons = btn.parentElement.children;
	// Mark active button
	for (let i = 0; i < buttons.length; i++) {
		child = buttons.item(i);
		if (child.type == "button") {
			if (child == btn) {			
				child.className = "btn btn-primary";
			}
			else {
				child.className = "btn btn-default";
			}
		}		
	}
}

function requestStateUpdate() {
	var message = new Paho.MQTT.Message("update");
	message.destinationName = "heater/command/state";
	mqttClient.send(message);	
}

function startBtnClicked(btn) {
	var message = new Paho.MQTT.Message("start");
	message.destinationName = "heater/command/start";
	mqttClient.send(message);
}

function stopBtnClicked(btn) {
	var message = new Paho.MQTT.Message("stop");
	message.destinationName = "heater/command/stop";
	mqttClient.send(message);
}

$('.bootstrap-timepicker> input').timepicker({minuteStep:15});





