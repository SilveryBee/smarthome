# BoilerControl MQTT Quick Reference

## File Organization

```
BoilerControl/
├── boilercontrol.html          # Main UI - loads scripts in order
├── webio_mqtt.js               # MQTT connection & message routing
├── ui.js                        # UI handlers & event binding
├── MQTT_INTEGRATION.md         # Detailed integration docs
├── EXECUTION_FLOW.md           # Data flow diagrams
└── QUICK_REFERENCE.md          # This file
```

## Script Load Order

```html
<!-- 1. Paho MQTT library -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js"></script>

<!-- 2. MQTT connection (executes immediately) -->
<script src="webio_mqtt.js"></script>

<!-- 3. UI handlers (deferred until DOM ready) -->
<script src="ui.js" defer></script>
```

**Important:** The `defer` attribute on ui.js ensures DOM elements exist before handlers bind.

## MQTT Broker Details

```javascript
hostname: "542eae39098649348d20f0029dc1ac86.s1.eu.hivemq.cloud"
port: 8884 (WebSocket Secure)
username: "polaris"
password: "84jdF8fGF95"
subscription: "heater/#"
clientId: "542eae39098649348d20f0029dc1ac86" + timestamp
keepAliveInterval: 10 seconds
```

## Common Tasks

### Add a New MQTT Message Handler

1. **Edit webio_mqtt.js** - Add case in `MessageArrived()`:
```javascript
case "newstatus":
    handleNewStatus(message.payloadString);
    break;
```

2. **Edit ui.js** - Implement handler:
```javascript
function handleNewStatus(value) {
    console.log(`New status: ${value}`);
    // Update UI...
}
```

### Send a New Command

1. **Edit ui.js** - Create send function:
```javascript
function sendNewCommand(param1, param2) {
    const ms = new Uint8Array([param1, param2]);
    const message = new Paho.MQTT.Message(ms);
    message.destinationName = "boiler/command/mynewcmd";
    mqttClient.send(message);
}
```

2. **Call from event handler**:
```javascript
myButton.addEventListener('click', () => {
    sendNewCommand(123, 456);
});
```

### Add a New Program Field

1. **Update HTML** - Add input with data-program-id:
```html
<input 
    type="text" 
    id="prog1-custom" 
    class="program-input-field program-data-input" 
    data-program-id="1">
```

2. **Update ui.js** - Modify `onProgramInputChange()` to extract & send:
```javascript
function onProgramInputChange(event) {
    // ... existing code ...
    if (event.target.id.includes('custom')) {
        const customValue = document.getElementById(`prog${programId}-custom`).value;
        sendCustomCommand(programId, customValue);
    }
}
```

3. **Create send function** in ui.js:
```javascript
function sendCustomCommand(programId, value) {
    const ms = new Uint8Array([parseInt(programId), parseInt(value)]);
    const message = new Paho.MQTT.Message(ms);
    message.destinationName = "boiler/command/setcustom";
    mqttClient.send(message);
}
```

## MQTT Message Formats

### Text Messages (String)
```javascript
// Incoming
message.payloadString = "Some text"

// Outgoing
var message = new Paho.MQTT.Message("Some text");
message.destinationName = "boiler/command/topic";
mqttClient.send(message);
```

### Numeric Messages (Uint8Array)
```javascript
// Incoming
parseInt(message.payloadString)  // Convert to number

// Outgoing - Program Time [id, hour, minute]
var ms = new Uint8Array([1, 6, 30]);
var message = new Paho.MQTT.Message(ms);
message.destinationName = "boiler/command/setstart";
mqttClient.send(message);
```

### JSON Messages (Parsed Object)
```javascript
// Incoming
const settings = JSON.parse(message.payloadString);
settings.progCount        // Access properties
settings.programs[0]
settings.programs[0].hour

// Outgoing - Not currently used
// Would need: JSON.stringify() before sending
```

## Event Binding Pattern

All dynamic events must be bound in ui.js `DOMContentLoaded`:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    // Bind to static selectors
    document.querySelectorAll('.program-status-radio').forEach(radio => {
        radio.addEventListener('change', onProgramInputChange);
    });
    
    // Don't forget defer on ui.js script tag!
    // <script src="ui.js" defer></script>
});
```

## Debouncing Pattern

Text inputs wait 1000ms after user stops typing:

```javascript
const programTimers = {};
const DEBOUNCE_DELAY = 1000;

function onProgramInputChange(event) {
    const programId = event.target.dataset.programId;
    
    // Radio buttons = immediate
    if (event.target.type === 'radio') {
        sendCommand(...);
        return;
    }
    
    // Text inputs = debounce
    if (programTimers[programId]) {
        clearTimeout(programTimers[programId]);
    }
    
    programTimers[programId] = setTimeout(() => {
        sendCommand(...);
        programTimers[programId] = null;
    }, DEBOUNCE_DELAY);
}
```

## Hebrew Localization

Already built-in for BoilerControl:

```javascript
// Status display
const statusMap = {
    'active': 'פעיל',
    'off': 'כבוי',
    'once': 'חד-פעמי'
};

// Log messages
const logMessage = `תכנית ${programId} עברה למצב ${statusText}...`;
addToLog(logMessage);

// HTML
<html lang="he" dir="rtl">  // RTL layout
```

## Debugging Tips

### Browser Console Logging

```javascript
// MQTT connection
Connected to MQTT broker!
Connection lost: [error]

// Message routing
boiler/status/temp : 45
boiler/status/heating : 1

// Handler execution
Temp received: 45°C (target: 50°C, heating: false)
Sent program 1 time: 06:30
Deactivating program 1
```

### Network Inspection

1. Open DevTools → Network tab
2. Filter for WebSocket
3. Look for `wss://...hivemq.cloud:8884`
4. Inspect WebSocket frames for message payloads

### MQTT Broker Dashboard

Visit HiveMQ Cloud console to:
- See connected clients
- Monitor published messages
- Test message publishing
- View connection logs

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| No connection | Script load order | Check Paho CDN loads first |
| Undefined mqttClient | webio_mqtt.js didn't load | Check script src path |
| No event binding | DOMContentLoaded hasn't fired | Check `defer` on ui.js |
| Debounce not working | Timer not cleared | Verify `clearTimeout()` called |
| Hebrew text wrong | RTL not set | Check `dir="rtl"` on html tag |
| Gauge not updating | Wrong element ID | Verify id="gaugeText", id="gaugeFill" |

## Performance Notes

- **Debounce Delay:** 1000ms = 1 second
  - Adjustable via `DEBOUNCE_DELAY` constant
  - Reduce for faster response, increase for less traffic

- **Keep-Alive Interval:** 10 seconds
  - Connection stays alive without activity
  - Adjustable in webio_mqtt.js `Connect()` function

- **Gauge Animation:** CSS transitions 0.5 seconds
  - Set in `width 0.5s ease`
  - Matches typical MQTT update frequency

- **Event Log:** Max 10 entries displayed
  - Oldest entries removed when limit exceeded
  - Keeps DOM lightweight

## Browser Compatibility

- **WebSocket Support:** Required (modern browsers)
- **CSS Grid:** Used in responsive layout
- **Fetch/Async:** Not currently used
- **ES6:** Template literals, arrow functions, const/let

**Minimum Versions:**
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Testing Checklist

- [ ] Browser console shows "Connected to MQTT broker!"
- [ ] Changing time inputs logs MQTT send
- [ ] Clicking program status sends activate command
- [ ] Gauge updates when device sends temperature
- [ ] Heating animation toggles correctly
- [ ] Event log timestamps appear
- [ ] Program settings restore correctly
- [ ] Automatic reconnection works after disconnect
- [ ] Hebrew text displays correctly with RTL layout
