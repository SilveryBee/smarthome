# BoilerControl MQTT Execution Flow

## Application Startup Sequence

```
1. Browser loads boilercontrol.html
   ↓
2. Script tags load in order:
   - Paho MQTT Library (CDN)
   - webio_mqtt.js → Initializes MQTT client
   - ui.js (defer) → Binds event handlers
   ↓
3. webio_mqtt.js execution:
   - Creates MQTT client
   - Calls Connect() → connects to HiveMQ
   ↓
4. ConnectionLost callback:
   - If error, calls Connect() again (auto-reconnect)
   ↓
5. Connected callback:
   - Subscribes to "boiler/#"
   - Calls requestStateUpdate()
   - Sends "update" to "boiler/command/state"
   ↓
6. ui.js DOMContentLoaded:
   - Binds program input event listeners
   - Binds start/stop button handlers
   - Clears log and adds startup message
```

## Incoming MQTT Message Flow

```
HiveMQ Broker receives device message
   ↓ (e.g., "boiler/status/temp : 45")
MessageArrived(message) in webio_mqtt.js
   ↓
Parse topic: ["heater", "status", "temp"]
   ↓
Switch on dest = "temp"
   ↓
Call setCurrentTempValue(45) in ui.js
   ↓
Extract target temp from gauge text (e.g., "45°C (יעד: 50°C)")
   ↓
Get heating state from gaugeFill.classList
   ↓
Call window.updateBoilerStatus(45, 50, false)
   ↓
Update gauge in boilercontrol.html:
   - Calculate percentage: (45-10)/(70-10) = 58%
   - Set .gauge-fill width = 58%
   - Set target marker left position
   - Update text "45°C (יעד: 50°C)"
   - Toggle heating animation
```

## Outgoing Command Flow (Program Time Change)

```
User modifies prog1-time input
   ↓
onProgramInputChange() fires
   ↓
Checks event.target.type = 'time' (text input)
   ↓
Clears previous debounce timer
   ↓
Sets new timer for 1000ms
   ↓
Timer expires (user stopped typing)
   ↓
Extract time: "06:30" → [6, 30]
   ↓
sendProgramTime(1, 6, 30)
   ↓
Create Uint8Array [1, 6, 30]
   ↓
Create Paho MQTT Message
   ↓
Set destinationName = "boiler/command/setstart"
   ↓
mqttClient.send(message)
   ↓
HiveMQ Broker delivers to boiler device
   ↓
logProgramChange() adds entry to event log
```

## Outgoing Command Flow (Radio Button Click)

```
User clicks program status radio (e.g., "פעיל")
   ↓
onProgramInputChange() fires
   ↓
Checks event.target.type = 'radio'
   ↓
Gets time, temp, status from current values
   ↓
Calls sendProgramActivate(progId, status) immediately (NO DEBOUNCE)
   ↓
Map status to state: 'active' → 2
   ↓
Create Uint8Array [1, 2]
   ↓
Send to "boiler/command/activate"
   ↓
logProgramChange() logs to event log in Hebrew
```

## Program Settings Restoration Flow

```
HiveMQ sends: "boiler/status/settings : {JSON}"
   ↓
MessageArrived() calls restoreSettings(jsonString)
   ↓
Parse JSON:
   {
     "progCount": 3,
     "programs": [
       {"hour": 6, "min": 30, "temp": 50, "state": "active"},
       ...
     ]
   }
   ↓
For each program i = 1 to progCount:
   - Find #prog{i}-time input
   - Set value = "06:30" (formatted)
   - Find #prog{i}-temp input
   - Set value = 50
   - Find input[name="prog{i}-status"] with state value
   - Set checked = true
   ↓
Log "הגדרות שוחזרו בהצלחה."
```

## Error Recovery Flow

```
Network interruption detected
   ↓
ConnectionLost(errorCode != 0)
   ↓
Log "Connection lost: [error message]"
   ↓
Call Connect()
   ↓
Attempt MQTT reconnection
   ↓
keepAliveInterval = 10 seconds
   ↓
If successful → Connected() → Subscribe again
   ↓
If failed → ConnectionFailed() → Log error
```

## Gauge Update Cycle

```
Every MQTT temperature message (e.g., 1 second intervals)
   ↓
setCurrentTempValue(newTemp) called
   ↓
Current gauge text parsed: "XX°C (יעד: YY°C)"
   ↓
Target temp extracted as YY
   ↓
Heating state checked: classList.contains('heating-active')
   ↓
updateBoilerStatus(newTemp, targetYY, isHeating)
   ↓
Clamp values between 10-70°C
   ↓
Calculate percentage: (temp - 10) / 60 * 100
   ↓
CSS Transition: width 0.5s ease
   ↓
Gauge visually animates to new width
   ↓
Target marker also animates to new position
```

## Key Integration Points

### From webio_mqtt.js to ui.js:
- ✅ `setCurrentTempValue()` - Called on temp message
- ✅ `setHeatingActive()` - Called on heating state
- ✅ `logAppend()` - Called on log message
- ✅ `restoreSettings()` - Called on settings message
- ✅ `deactivateProgram()` - Called after one-time execution
- ✅ `logClear()` - Called to clear log

### From ui.js to boilercontrol.html:
- ✅ `window.updateBoilerStatus()` - Updates gauge visually
- ✅ `addToLog()` - Adds entries to #logList

### From ui.js to webio_mqtt.js:
- ✅ `mqttClient` - Global MQTT client object
- ✅ `mqttClient.send()` - Sends commands

## Program State During Session

```javascript
// ui.js maintains state:
var programTimers = {
    1: null,  // Debounce timer for program 1
    2: null,  // Debounce timer for program 2
    3: null   // Debounce timer for program 3
};

// HTML maintains state:
<input id="prog1-time" value="06:00"> // Current display value
<input id="prog1-temp" value="50">
<input name="prog1-status" value="active" checked> // Current state

// Gauge maintains state:
.gauge-fill[style="width: 58%"]
.gauge-fill.heating-active (class present if heating)
```

## Connection State Machine

```
[DISCONNECTED]
     ↓ Connect()
[CONNECTING]
     ↓ onSuccess
[CONNECTED] → Subscribe("boiler/#")
     ↓         → requestStateUpdate()
   ↓ (error)
[RECONNECTING] ← Auto-reconnect
     ↓
loops back to [CONNECTING]

During CONNECTED state:
- MessageArrived() processes incoming messages
- User actions send commands via mqttClient.send()
- connectionLost() event triggers reconnection if needed
```
