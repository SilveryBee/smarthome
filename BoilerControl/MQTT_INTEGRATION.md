# BoilerControl MQTT Integration Summary

## Overview
BoilerControl has been fully integrated with MQTT connectivity to match HeaterControl's functional capabilities while maintaining its modern horizontal gauge UI and Hebrew localization.

## Files Modified/Created

### 1. **webio_mqtt.js** (Modified)
- **Topic:** Changed from `heater/#` to `boiler/#`
- **Function:** Added missing `requestStateUpdate()` function
- **Broker:** HiveMQ Cloud (542eae39098649348d20f0029dc1ac86.s1.eu.hivemq.cloud:8884)
- **Authentication:** polaris/84jdF8fGF95

### 2. **ui.js** (Created)
New UI handler module that maps MQTT messages to boilercontrol's modern UI:

#### Incoming MQTT Messages (from device):
- `boiler/status/temp` → Updates horizontal gauge with `setCurrentTempValue()`
- `boiler/status/heating` → Sets heating animation with `setHeatingActive()`
- `boiler/status/log` → Appends to event log
- `boiler/status/settings` → Restores program configuration from JSON
- `boiler/status/deactivate` → Resets program state after one-time execution

#### Outgoing MQTT Commands (to device):
- `boiler/command/setstart` → [programId, hour, minute]
- `boiler/command/settemp` → [programId, temperature]
- `boiler/command/activate` → [programId, state(1=off,2=active,3=once)]
- `boiler/command/start` → Immediate heating start
- `boiler/command/stop` → Immediate heating stop
- `boiler/command/state` → Request current device state (sent on connection)

#### Key Features:
✅ **Input Debouncing (1000ms):**
- Text inputs (time, temp) debounce before sending MQTT commands
- Radio buttons send immediately

✅ **Hebrew Localization:**
- Status logging in Hebrew
- RTL UI maintained
- Hebrew month/day translations in logs

✅ **Event Log:**
- Timestamps for all events
- Maintains last 10 entries
- Auto-scrolls with new entries

✅ **Gauge Integration:**
- Calls `window.updateBoilerStatus(currentTemp, targetTemp, isHeating)` from HTML
- Horizontal bar visualization with target marker
- Heating animation (orange striped) when active

### 3. **boilercontrol.html** (Modified)
- **Line 7-9:** Added MQTT script references:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js"></script>
  <script src="webio_mqtt.js" type="text/javascript"></script>
  <script src="ui.js" type="text/javascript" defer></script>
  ```
- **Removed:** Inline program event handlers (now delegated to ui.js)
- **Kept:** Gauge update logic (calls `updateBoilerStatus()`)
- **All HTML elements:** Already have proper IDs and data attributes for MQTT binding

## Program Data Attributes

Each program input has the required attributes for MQTT integration:

```html
<!-- Program 1 Example -->
<input type="time" id="prog1-time" class="program-data-input" data-program-id="1">
<input type="number" id="prog1-temp" class="program-data-input" data-program-id="1">
<input type="radio" name="prog1-status" class="program-status-radio" data-program-id="1" value="active">
```

The `data-program-id` attribute enables the debouncing mechanism and MQTT command routing.

## Testing Checklist

To verify MQTT integration:

1. **Browser Console:**
   - Check for "Connected to MQTT broker!" message
   - Verify messages logged: `boiler/status/temp : 45`

2. **Connection:**
   - App auto-reconnects if connection lost
   - Keep-alive interval: 10 seconds

3. **Status Updates:**
   - Change target temp → sends `boiler/command/settemp`
   - Click program status radio → sends `boiler/command/activate`
   - Modify program time → debounce 1s → sends `boiler/command/setstart`

4. **Gauge Display:**
   - Horizontal bar width updates with temperature
   - Target marker shows red line
   - Orange striped animation when heating

5. **Event Log:**
   - Displays connection status
   - Shows program changes in Hebrew
   - Maintains max 10 entries

## Differences from HeaterControl

| Feature | HeaterControl | BoilerControl |
|---------|--------------|---------------|
| **UI Style** | Radial gauge (legacy) | Horizontal bar (modern) |
| **Language** | English | Hebrew (RTL) |
| **Script Organization** | Separate ui.js + inline CSS | Combined ui.js + inline CSS |
| **Gauge Animation** | CSS rotation | Width percentage + animation |
| **Time Input** | Bootstrap Timepicker | Native HTML5 time input |
| **Log Display** | Text area (console-like) | List items with timestamps |

## MQTT Topics Reference

### Subscribe (boiler → browser):
### Subscribe (heater → browser):
`heater/status/temp` - Current temperature (int)
`heater/status/heating` - Heating state (0/1)
`heater/status/log` - Log message (string)
`heater/status/logClear` - Clear log signal
`heater/status/settings` - Program settings (JSON)
`heater/status/deactivate` - Program ID to deactivate

### Publish (browser → boiler):
### Publish (browser → heater):
`heater/command/setstart` - Set program start time
`heater/command/settemp` - Set program temperature
`heater/command/activate` - Set program state
`heater/command/start` - Immediate heating start
`heater/command/stop` - Immediate heating stop
`heater/command/state` - Request current device state

## Future Enhancements

- [ ] Extract MQTT credentials to config file
- [ ] Add connection status indicator in UI
- [ ] Implement offline queue for commands
- [ ] Add program scheduling calendar view
- [ ] Export/import program configurations
- [ ] Multi-language support (currently Hebrew only)
