/**
 * PondManager UI Handler
 * Manages gauge updates, button interactions, and event logging
 */

// Gauge configuration
const WATER_LEVEL_MAX = 70; // cm (distance from sensor when empty/low water)
const WATER_LEVEL_MIN = 5;  // cm (distance from sensor when full/high water)
const FLOW_RATE_MAX = 10;    // L/min (maximum expected flow rate)

// SVG circle circumference (2 * PI * radius, where radius = 52)
const CIRCLE_CIRCUMFERENCE = 327;

// Track last known SSID to detect changes
let lastSsid = null;

/**
 * Initialize UI when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("PondManager UI initialized");
    
    // Bind button event handlers
    const openBtn = document.getElementById('openValveBtn');
    const closeBtn = document.getElementById('closeValveBtn');
    const resetBtn = document.getElementById('resetDeviceBtn');
    const openWaterfallBtn = document.getElementById('openWaterfallBtn');
    const closeWaterfallBtn = document.getElementById('closeWaterfallBtn');
    const desiredLevelInput = document.getElementById('desiredLevelInput');
    
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            console.log("Open valve button clicked");
            sendValveCommand('open');
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log("Close valve button clicked");
            sendValveCommand('close');
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Restart the device now?')) {
                console.log("Reset device button clicked");
                sendResetCommand();
            }
        });
    }

    if (openWaterfallBtn) {
        openWaterfallBtn.addEventListener('click', () => {
            sendWaterfallCommand('open');
        });
    }

    if (closeWaterfallBtn) {
        closeWaterfallBtn.addEventListener('click', () => {
            sendWaterfallCommand('close');
        });
    }
    
    if (desiredLevelInput) {
        // Send desired level on change with debouncing
        let debounceTimer;
        desiredLevelInput.addEventListener('change', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const level = parseFloat(desiredLevelInput.value);
                if (!isNaN(level)) {
                    sendDesiredLevel(level);
                }
            }, 500);
        });
    }
    
    // Initialize gauges with default values
    updateWaterLevel(50);
    updateValveStatus(false);
    updateFlowRate(0);
    
    // Add initial log message
    logAppend("UI initialized. Waiting for connection...");
});

/**
 * Set online status indicator
 * @param {boolean} online - True if ESP is online
 */
window.setOnlineStatus = function(online) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (statusDot) {
        if (online) {
            statusDot.classList.add('online');
        } else {
            statusDot.classList.remove('online');
        }
    }
    
    if (statusText) {
        statusText.textContent = online ? (lastSsid ? `ESP Online | ${lastSsid}` : 'ESP Online') : 'ESP Offline';
    }
    
    // Enable/disable controls based on connection
    const openBtn = document.getElementById('openValveBtn');
    const closeBtn = document.getElementById('closeValveBtn');
    const resetBtn = document.getElementById('resetDeviceBtn');
    const openWaterfallBtn = document.getElementById('openWaterfallBtn');
    const closeWaterfallBtn = document.getElementById('closeWaterfallBtn');
    if (openBtn) openBtn.disabled = !online;
    if (closeBtn) closeBtn.disabled = !online;
    if (resetBtn) resetBtn.disabled = !online;
    if (openWaterfallBtn) openWaterfallBtn.disabled = !online;
    if (closeWaterfallBtn) closeWaterfallBtn.disabled = !online;
};

/**
 * Update pond state from MQTT message
 * @param {Object} state - State object with waterLevel, valveOpen, flowRate, totalFlow, desiredLevel
 */
window.updatePondState = function(state) {
    console.log("State update:", state);
    
    // Update water level (assuming state.waterLevel is percentage or distance in cm)
    if (state.waterLevel !== undefined) {
        updateWaterLevel(state.waterLevel);
    }
    
    // Update valve status
    if (state.valveOpen !== undefined) {
        updateValveStatus(state.valveOpen);
    }

    // Update waterfall valve status
    if (state.waterfallValveOpen !== undefined) {
        updateWaterfallStatus(state.waterfallValveOpen);
    }
    
    // Update flow rate
    if (state.flowRate !== undefined) {
        updateFlowRate(state.flowRate);
    }
    
    // Update desired level input
    if (state.desiredLevel !== undefined) {
        const desiredLevelInput = document.getElementById('desiredLevelInput');
        if (desiredLevelInput) {
            desiredLevelInput.value = state.desiredLevel;
        }
    }
    
    // Log total flow if available
    if (state.totalFlow !== undefined) {
        console.log("Total flow:", state.totalFlow, "L");
    }
    
    // Update SSID in status bar and log if changed
    if (state.ssid !== undefined && state.ssid !== lastSsid) {
        lastSsid = state.ssid;
        const timestamp = new Date().toLocaleTimeString();
        logAppend(`[${timestamp}] Connected to WiFi: ${state.ssid}`);
        const statusText = document.getElementById('statusText');
        if (statusText && statusText.textContent.startsWith('ESP Online')) {
            statusText.textContent = `ESP Online | ${state.ssid}`;
        }
    }

    // Log state update
    const timestamp = new Date().toLocaleTimeString();
    logAppend(`[${timestamp}] State updated: Level=${state.waterLevel}, Valve=${state.valveOpen ? 'OPEN' : 'CLOSED'}, Flow=${state.flowRate || 0}L/min`);
};

/**
 * Update water level gauge
 * @param {number} level - Water level as distance in cm (5-70)
 */
function updateWaterLevel(level) {
    const fill = document.getElementById('waterLevelFill');
    const text = document.getElementById('waterLevelText');
    
    if (!fill || !text) return;
    
    // ESP sends level as distance in cm (5cm = full, 70cm = empty)
    // Convert to percentage for gauge display (inverted)
    const MIN_CM = 5;   // Full tank
    const MAX_CM = 70;  // Empty tank
    let percent = ((MAX_CM - level) / (MAX_CM - MIN_CM)) * 100;
    percent = Math.max(0, Math.min(100, percent));
    
    // Update circular gauge (327 is full circle)
    const offset = CIRCLE_CIRCUMFERENCE - (CIRCLE_CIRCUMFERENCE * percent / 100);
    fill.style.strokeDashoffset = offset;
    
    // Update text to show cm
    text.innerHTML = `${Math.round(level)}<small>cm</small>`;
}

/**
 * Update valve status gauge
 * @param {boolean} isOpen - True if valve is open
 */
function updateValveStatus(isOpen) {
    const gaugeBox = document.getElementById('valveGaugeBox');
    const fill = document.getElementById('valveFill');
    const text = document.getElementById('valveText');
    
    if (!fill || !text || !gaugeBox) return;
    
    // Update gauge styling
    if (isOpen) {
        gaugeBox.classList.remove('valve-closed');
        gaugeBox.classList.add('valve-open');
        fill.style.strokeDashoffset = 0; // Full circle
        text.textContent = 'OPEN';
    } else {
        gaugeBox.classList.remove('valve-open');
        gaugeBox.classList.add('valve-closed');
        fill.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE; // Empty circle
        text.textContent = 'CLOSED';
    }
}

/**
 * Update waterfall valve status gauge
 * @param {boolean} isOpen - True if waterfall valve is open
 */
function updateWaterfallStatus(isOpen) {
    const gaugeBox = document.getElementById('waterfallGaugeBox');
    const fill = document.getElementById('waterfallFill');
    const text = document.getElementById('waterfallText');

    if (!fill || !text || !gaugeBox) return;

    if (isOpen) {
        gaugeBox.classList.remove('valve-closed');
        gaugeBox.classList.add('valve-open');
        fill.style.strokeDashoffset = 0;
        text.textContent = 'ON';
    } else {
        gaugeBox.classList.remove('valve-open');
        gaugeBox.classList.add('valve-closed');
        fill.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
        text.textContent = 'OFF';
    }
}

/**
 * Update flow rate gauge
 * @param {number} flowRate - Flow rate in L/min
 */
function updateFlowRate(flowRate) {
    const fill = document.getElementById('flowFill');
    const text = document.getElementById('flowText');
    
    if (!fill || !text) return;
    
    // Clamp to max
    const clamped = Math.max(0, Math.min(FLOW_RATE_MAX, flowRate));
    const percent = (clamped / FLOW_RATE_MAX) * 100;
    
    // Update circular gauge
    const offset = CIRCLE_CIRCUMFERENCE - (CIRCLE_CIRCUMFERENCE * percent / 100);
    fill.style.strokeDashoffset = offset;
    
    // Update text
    text.innerHTML = `${flowRate.toFixed(1)}<small>L/min</small>`;
}

/**
 * Append message to event log
 * @param {string} message - Log message
 */
window.logAppend = function(message) {
    const logList = document.getElementById('logList');
    if (!logList) return;
    
    const li = document.createElement('li');
    li.textContent = message;
    logList.appendChild(li);
    
    // Keep only last 50 messages
    while (logList.children.length > 50) {
        logList.removeChild(logList.firstChild);
    }
    
    // Auto-scroll to bottom
    logList.scrollTop = logList.scrollHeight;
};

/**
 * Clear event log
 */
window.logClear = function() {
    const logList = document.getElementById('logList');
    if (logList) {
        logList.innerHTML = '';
        logAppend("Log cleared");
    }
};
