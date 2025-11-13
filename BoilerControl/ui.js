/**
 * Boiler Control UI Handler
 * Maps MQTT messages to boilercontrol's modern horizontal gauge UI
 * Handles program changes with debouncing and Hebrew localization
 */

// Program state tracking
var programTimers = {};
const DEBOUNCE_DELAY = 1000;
// Immediate temp debounce
var immediateTempTimer = null;
var immediateTempVal = null;
// Target temp state (set when heater/status/targetTemp is received)
window.hasTargetTemp = false;
window.latestTargetTemp = null;

// UI temp bounds (used for marker position calculations)
const UI_MIN_TEMP = 10;
const UI_MAX_TEMP = 70;
const UI_TEMP_RANGE = UI_MAX_TEMP - UI_MIN_TEMP;

/**
 * Set the target temperature (called by MQTT handler)
 * positions the marker and updates visibility based on heating state
 */
window.setTargetTemp = function(tgt) {
    const parsed = parseFloat(tgt);
    if (isNaN(parsed)) {
        window.hasTargetTemp = false;
        window.latestTargetTemp = null;
        return;
    }
    window.latestTargetTemp = parsed;
    window.hasTargetTemp = true;

    const marker = document.getElementById('targetMarker');
    const gaugeFill = document.getElementById('gaugeFill');
    try {
        if (marker) {
            const clampedTarget = Math.max(UI_MIN_TEMP, Math.min(UI_MAX_TEMP, parsed));
            const targetPercent = ((clampedTarget - UI_MIN_TEMP) / UI_TEMP_RANGE) * 100;
            marker.style.left = `calc(${targetPercent}% - 1px)`;
            const heatingActive = gaugeFill && gaugeFill.classList.contains('heating-active');
            marker.style.display = (heatingActive && window.hasTargetTemp) ? 'block' : 'none';
        }
        // Update gauge text only when heating AND target exists
        const gaugeText = document.getElementById('gaugeText');
        if (gaugeText) {
            const currentTextMatch = gaugeText.textContent.match(/(\d+)(?:°C)?/);
            const currentVal = currentTextMatch ? parseInt(currentTextMatch[1]) : null;
            let text = currentVal !== null ? `${currentVal}°C` : `${Math.round(parsed)}°C`;
            if (gaugeFill && gaugeFill.classList.contains('heating-active') && window.hasTargetTemp) {
                text += ` (יעד: ${Math.round(parsed)}°C)`;
            }
            gaugeText.textContent = text;
        }
    } catch (e) {
        console.warn('setTargetTemp error', e);
    }
};

// Language mapping for program status
const statusMap = {
    'active': 'פעיל',
    'off': 'כבוי',
    'once': 'חד-פעמי'
};

// State values for MQTT transmission
const stateValues = {
    'off': 1,
    'active': 2,
    'once': 3
};

/**
 * Incoming MQTT message: boiler/status/temp
 * Updates the gauge with current temperature
 */
function setCurrentTempValue(value) {
    // Get current target from display if available
    const gaugeText = document.getElementById('gaugeText');
    const currentText = gaugeText ? gaugeText.textContent : '';
    
    // Extract target temp from "XX°C (יעד: YY°C)" format
    let targetTemp = 50;
    const targetMatch = currentText.match(/יעד:\s*(\d+)/);
    if (targetMatch) {
        targetTemp = parseInt(targetMatch[1]);
    }
    
    // Get heating state
    const gaugeFill = document.getElementById('gaugeFill');
    const isHeating = gaugeFill ? gaugeFill.classList.contains('heating-active') : false;
    
    // Update gauge
    updateBoilerStatus(value, targetTemp, isHeating);
    
    console.log(`Temp received: ${value}°C (target: ${targetTemp}°C, heating: ${isHeating})`);
}

/**
 * Incoming MQTT message: boiler/status/heating
 * Updates heating indicator animation
 */
function setHeatingActive(value) {
    const gaugeFill = document.getElementById('gaugeFill');
    if (gaugeFill) {
        gaugeFill.classList.toggle('heating-active', value);
        console.log(`Heating: ${value}`);
        // Show or hide the target marker depending on heating state
        try {
            const marker = document.getElementById('targetMarker');
            if (marker) {
                // Only show marker when we have a target temperature
                marker.style.display = (value && window.hasTargetTemp) ? 'block' : 'none';
            }
        } catch (e) {
            console.warn('Could not update target marker visibility', e);
        }
    }
}

/**
 * Incoming MQTT message: boiler/status/log
 * Appends text to the event log
 */
function logAppend(text) {
    const logList = document.getElementById('logList');
    if (logList) {
        addToLog(text);
    }
    console.log(`Log: ${text}`);
}

/**
 * Incoming MQTT message: boiler/status/logClear
 * Clears the event log
 */
function logClear() {
    const logList = document.getElementById('logList');
    if (logList) {
        logList.innerHTML = '';
    }
    console.log('Log cleared');
}

/**
 * Incoming MQTT message: boiler/status/settings
 * Restores program settings from JSON buffer
 */
function restoreSettings(buffer) {
    try {
        const settings = JSON.parse(buffer);
        console.log(`Restoring settings for ${settings.progCount} programs`);
        
        // Update each program's settings
        for (let i = 1; i <= settings.progCount; i++) {
            const prog = settings["programs"][i - 1];
            
            // Parse and set time
            const d = new Date();
            d.setHours(prog["hour"]);
            d.setMinutes(prog["min"]);
            const timeStr = `${String(prog["hour"]).padStart(2, '0')}:${String(prog["min"]).padStart(2, '0')}`;
            
            const timeInput = document.getElementById(`prog${i}-time`);
            if (timeInput) timeInput.value = timeStr;
            
            // Set temperature
            const tempInput = document.getElementById(`prog${i}-temp`);
            if (tempInput) tempInput.value = prog["temp"];
            
            // Set state (normalize values coming from device)
            const stateValue = prog["state"];
            // normalize to one of: 'off', 'active', 'once'
            let normalizedState = 'off';
            if (typeof stateValue === 'number') {
                if (stateValue === 2) normalizedState = 'active';
                else if (stateValue === 3) normalizedState = 'once';
                else normalizedState = 'off';
            } else {
                const s = String(stateValue).toLowerCase();
                if (s === '2' || s === 'active' || s === 'on' || s === 'true') normalizedState = 'active';
                else if (s === '3' || s === 'once') normalizedState = 'once';
                else normalizedState = 'off';
            }

            const statusRadios = document.querySelectorAll(`input[name="prog${i}-status"]`);
            statusRadios.forEach(radio => {
                radio.checked = (radio.value === normalizedState);
            });
            
            console.log(`Program ${i}: ${timeStr}, temp=${prog["temp"]}°C, state=${stateValue}`);
        }

        // Restore immediate program temp (matches heatercontrol behavior - temp stored at programs[progCount])
        try {
            if (settings["programs"] && settings["programs"].length > settings.progCount) {
                const imm = settings["programs"][settings.progCount];
                const immTemp = imm && imm["temp"] !== undefined ? imm["temp"] : null;
                const targetInput = document.getElementById('targetTempInput');
                if (targetInput && immTemp !== null) {
                    targetInput.value = immTemp;
                    console.log(`Restored immediate target temp: ${immTemp}`);
                }
            }
        } catch (e) {
            console.warn('Could not restore immediate program temp:', e);
        }

        addToLog(`הגדרות שוחזרו בהצלחה.`);
    } catch (e) {
        console.error('Error restoring settings:', e);
    }
}

/**
 * Incoming MQTT message: boiler/status/deactivate
 * Deactivates a program after one-time execution
 */
function deactivateProgram(id) {
    console.log(`Deactivating program ${id}`);
    const statusRadios = document.querySelectorAll(`input[name="prog${id}-status"]`);
    statusRadios.forEach(radio => {
        if (radio.value === 'off') {
            radio.checked = true;
        }
    });
}

function setCurrent(value) {
    console.log("setCurrent() " + value);
}

/**
 * Handles program input changes (time, temp, status)
 * Radio buttons send immediately, text inputs debounce
 */
function onProgramInputChange(event) {
    const programId = event.target.dataset.programId;
    
    // Radio buttons send immediately
    if (event.target.type === 'radio') {
        const timeValue = document.getElementById(`prog${programId}-time`).value;
        const tempValue = document.getElementById(`prog${programId}-temp`).value;
        const statusValue = event.target.value;
        
        const [timeHour, timeMinute] = timeValue.split(':');
        
        // Send activate command
        sendProgramActivate(programId, statusValue);
        
        // Log change
        logProgramChange(programId, statusValue, timeHour, timeMinute, tempValue);
        return;
    }
    
    // Text/number inputs debounce
    if (programTimers[programId]) {
        clearTimeout(programTimers[programId]);
    }

    programTimers[programId] = setTimeout(() => {
        const timeValue = document.getElementById(`prog${programId}-time`).value;
        const tempValue = document.getElementById(`prog${programId}-temp`).value;
        
        const [timeHour, timeMinute] = timeValue.split(':');
        
        const statusElement = document.querySelector(`input[name="prog${programId}-status"]:checked`);
        const statusValue = statusElement ? statusElement.value : 'off';

        // Send commands based on input type
        if (event.target.id.includes('time')) {
            sendProgramTime(programId, timeHour, timeMinute);
        } else if (event.target.id.includes('temp')) {
            sendProgramTemp(programId, tempValue);
        }

        // Log change
        logProgramChange(programId, statusValue, timeHour, timeMinute, tempValue);

        programTimers[programId] = null;
    }, DEBOUNCE_DELAY);
}

/**
 * Send program time to device via MQTT
 * Message format: [programId, hour, minute]
 */
function sendProgramTime(programId, hour, minute) {
    const ms = new Uint8Array([parseInt(programId), parseInt(hour), parseInt(minute)]);
    const message = new Paho.MQTT.Message(ms);
    message.destinationName = "heater/command/setstart";
    mqttClient.send(message);
    console.log(`Sent program ${programId} time: ${hour}:${minute}`);
}

/**
 * Send program temperature to device via MQTT
 * Message format: [programId, temperature]
 */
function sendProgramTemp(programId, temp) {
    const ms = new Uint8Array([parseInt(programId), parseInt(temp)]);
    const message = new Paho.MQTT.Message(ms);
    message.destinationName = "heater/command/settemp";
    mqttClient.send(message);
    console.log(`Sent program ${programId} temp: ${temp}°C`);
}

/**
 * Send program activation state to device via MQTT
 * States: 1=off, 2=active, 3=once
 * Message format: [programId, state]
 */
function sendProgramActivate(programId, statusValue) {
    const stateValue = stateValues[statusValue] || 1;
    const ms = new Uint8Array([parseInt(programId), stateValue]);
    const message = new Paho.MQTT.Message(ms);
    message.destinationName = "heater/command/activate";
    mqttClient.send(message);
    console.log(`Sent program ${programId} activation: ${statusValue} (state=${stateValue})`);
}

/**
 * Send immediate heating start command
 */
function sendImmediateStart() {
    const message = new Paho.MQTT.Message("start");
    message.destinationName = "heater/command/start";
    mqttClient.send(message);
    console.log('Sent immediate start command');
}

/**
 * Immediate temp changed handler + sender
 */
function immediateTempChanged(event) {
    if (immediateTempTimer) clearTimeout(immediateTempTimer);
    const v = parseInt(event.target.value);
    if (isNaN(v)) return;
    immediateTempVal = v;
    immediateTempTimer = setTimeout(sendImmediateTemp, DEBOUNCE_DELAY);
}

function sendImmediateTemp() {
    if (immediateTempVal === null) return;
    try {
        // Determine immediate program id as (number of program blocks) + 1
        const progCount = document.querySelectorAll('.program-block').length || 0;
        const immProgId = progCount + 1; // matches heater_control's temp4 for 3 programs
        const ms = new Uint8Array([parseInt(immProgId), parseInt(immediateTempVal)]);
        const message = new Paho.MQTT.Message(ms);
        message.destinationName = "heater/command/settemp";
        mqttClient.send(message);
        console.log(`Sent immediate program temp: prog=${immProgId} temp=${immediateTempVal}`);
        addToLog(`שליחת טמפרטורת מיידית: ${immediateTempVal}°C (תוכנית ${immProgId})`);
    } catch (e) {
        console.error('Failed to send immediate temp:', e);
    }
    immediateTempTimer = null;
    immediateTempVal = null;
}

/**
 * Send immediate heating stop command
 */
function sendImmediateStop() {
    const message = new Paho.MQTT.Message("stop");
    message.destinationName = "heater/command/stop";
    mqttClient.send(message);
    console.log('Sent immediate stop command');
}

/**
 * Logs program changes to the event log
 */
function logProgramChange(programId, status, timeHour, timeMinute, temp) {
    const statusText = statusMap[status] || status;
    const logMessage = `תכנית ${programId} עברה למצב ${statusText} עם זמן התחלה של ${timeHour}:${timeMinute} וטמפרטורת יעד של ${temp} מעלות.`;
    
    console.log(logMessage);
    addToLog(logMessage);
}

/**
 * Adds a timestamped message to the event log
 */
function addToLog(message) {
    const logList = document.getElementById('logList');
    if (logList) {
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0];
        const newItem = document.createElement('li');
        newItem.textContent = `${timeString} - ${message}`;
        
        if (logList.firstChild) {
            logList.insertBefore(newItem, logList.firstChild);
        } else {
            logList.appendChild(newItem);
        }
        
        // Keep only last 10 entries
        while (logList.children.length > 10) {
            logList.removeChild(logList.lastChild);
        }
    }
}

/**
 * Initialize event listeners and gauge update
 */
document.addEventListener('DOMContentLoaded', () => {
    // Bind program input listeners
    const allProgramRadios = document.querySelectorAll('.program-status-radio');
    allProgramRadios.forEach(radio => {
        radio.addEventListener('change', onProgramInputChange);
    });

    const allProgramDataInputs = document.querySelectorAll('.program-data-input');
    allProgramDataInputs.forEach(input => {
        input.addEventListener('input', onProgramInputChange);
    });

    // Bind immediate control buttons
    const startHeatBtn = document.getElementById('startHeatBtn');
    const stopHeatBtn = document.getElementById('stopHeatBtn');
    
    if (startHeatBtn) {
        startHeatBtn.addEventListener('click', () => {
            const targetTemp = parseFloat(document.getElementById('targetTempInput').value);
            if (!isNaN(targetTemp)) {
                sendImmediateStart();
                addToLog(`מפעיל חימום מיידי. טמפרטורת יעד: ${targetTemp}°C`);
            }
        });
    }
    
    if (stopHeatBtn) {
        stopHeatBtn.addEventListener('click', () => {
            sendImmediateStop();
            addToLog('מפסיק חימום מיידי.');
        });
    }

    // Bind immediate target temp input to send test temp on change (debounced)
    const targetTempInput = document.getElementById('targetTempInput');
    if (targetTempInput) {
        targetTempInput.addEventListener('input', immediateTempChanged);
    }

    // Clear log and add startup message
    const logList = document.getElementById('logList');
    if (logList) {
        logList.innerHTML = '';
        addToLog("המערכת נטענה בהצלחה.");
    }
});
