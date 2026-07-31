# Pond Manager Web Application

Web-based control interface for the ESP8266 Pond Water Management System.

## Overview

This web application provides real-time monitoring and control of the pond water level management system via MQTT. It displays water level, valve status, and flow rate information, and allows manual control of the filling valve.

## Files

- **pondmanager.html** - Main HTML interface with gauges and controls
- **pondmanager_mqtt.js** - MQTT communication handler
- **pondmanager_ui.js** - UI logic and gauge updates

## Features

### 1. Real-time Monitoring
- **Water Level Gauge**: Displays current water distance from ultrasonic sensor (in cm)
- **Valve Status Gauge**: Shows whether the valve is OPEN or CLOSED
- **Flow Rate Gauge**: Displays current water flow rate (L/min)
- **ESP Status Indicator**: Shows online/offline status of the ESP8266

### 2. Manual Control
- **Open/Close Valve**: Manual buttons to control the filling valve
- **Set Desired Level**: Input field to set the target water level (distance in cm from sensor)

### 3. Event Logging
- Real-time event log showing:
  - Connection status
  - State updates
  - Valve commands
  - System errors
- Auto-scrolls to latest entries
- Maintains last 50 log entries

## MQTT Topics

### Subscribe Topics (ESP → Web)
- `pondmanager/state` - JSON state updates:
  ```json
  {
    "waterLevel": 45,
    "valveOpen": false,
    "flowRate": 0.0,
    "totalFlow": 125.5,
    "notification": false,
    "version": "1.0.0"
  }
  ```
- `pondmanager/log` - Text log messages
- `pondmanager/error` - Error messages

### Publish Topics (Web → ESP)
- `pondmanager/command/state` - Request state update (payload: "update")
- `pondmanager/command` - Send commands:
  ```json
  { "valve": "open" }
  { "valve": "close" }
  { "desiredLevel": 30 }
  ```

## Configuration

Edit `pondmanager_mqtt.js` to configure MQTT broker settings:

```javascript
var hostname = "your-mqtt-broker.com";
var port = 8884;
var username = "your-username";
var password = "your-password";
var subscription = "pondmanager/#";
```

## Water Level Display

The water level gauge shows the **distance from the ultrasonic sensor** in centimeters:
- **Smaller distance** (e.g., 10 cm) = Tank is fuller
- **Larger distance** (e.g., 100 cm) = Tank is emptier

The gauge automatically converts this to a visual "fullness" indicator where:
- Full circle = Maximum water level (sensor close to water)
- Empty circle = Minimum water level (sensor far from water)

## Usage

1. Open `pondmanager.html` in a web browser
2. The application will automatically connect to the MQTT broker
3. Wait for the status indicator to show "ESP Online"
4. Monitor gauges for real-time water level, valve status, and flow rate
5. Use manual controls to operate the valve:
   - Click "Open Valve" to start filling
   - Click "Close Valve" to stop filling
   - Set desired water level in the input field
6. View event log for system activity

## Browser Compatibility

- Modern browsers with WebSocket support
- Tested on Chrome, Firefox, Edge, Safari
- Mobile responsive design

## Dependencies

- **Paho MQTT JavaScript Client** v1.0.1 (loaded via CDN)
  - `https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js`

## Integration with ESP8266

This web app is designed to work with the PondManager ESP8266 firmware. The ESP must:

1. Connect to the same MQTT broker
2. Publish state updates to `pondmanager/state` (JSON format)
3. Subscribe to `pondmanager/command` for valve control
4. Subscribe to `pondmanager/command/state` for state update requests

## Development

To modify the UI:
- Edit HTML structure in `pondmanager.html`
- Update MQTT handlers in `pondmanager_mqtt.js`
- Modify gauge logic and event handlers in `pondmanager_ui.js`

## Troubleshooting

**Problem**: "ESP Offline" shown even when ESP is running
- Check MQTT broker connection
- Verify ESP is publishing to correct topics
- Check broker credentials match

**Problem**: Gauges not updating
- Open browser console (F12) to check for errors
- Verify MQTT messages are being received
- Check topic names match between ESP and web app

**Problem**: Commands not working
- Ensure ESP is subscribed to `pondmanager/command`
- Check MQTT message format in ESP firmware
- Verify buttons are enabled (online status)

## License

Part of the PondManager project by Ron Stern, 2026
