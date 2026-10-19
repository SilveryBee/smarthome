/*
 * config.js - shared broker endpoint for all SmartHome web apps
 *
 * Nothing secret belongs in this file. The MQTT username/password are asked
 * for once per device by auth.js and kept in that browser's localStorage.
 *
 * Set host to the Cloudflare Tunnel hostname for the broker (path /mqtt is
 * routed to Mosquitto's WebSockets listener on port 1884). While testing on
 * the LAN, use host "192.168.2.139", port 1884, path "/" and useSSL false.
 */
var MQTT_CONFIG = {
    // Filled in once the Cloudflare tunnel is live:
    host: "mqtt.example.com",
    port: 443,
    path: "/mqtt",
    useSSL: true,

    // Shown in the sign-in prompt so users know which app they are unlocking.
    appName: "SmartHome"
};
