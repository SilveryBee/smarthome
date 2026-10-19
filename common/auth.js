/*
 * auth.js - one-time MQTT credential prompt, shared by the boiler and pond UIs.
 *
 * The broker username/password are deliberately NOT in the page source: a
 * public URL therefore reveals nothing worth having. On first load the user
 * is asked once; ticking "remember" keeps them in this browser's localStorage,
 * so a family member signs in once per device and never again.
 *
 * Both apps live on the same origin, so a single sign-in covers both.
 *
 * API:
 *   SmartHomeAuth.require(function (creds) { ... })  // creds = {user, pass}
 *   SmartHomeAuth.forget()                           // drop the saved login
 */
window.SmartHomeAuth = (function () {
    var KEY_USER = "smarthome.mqtt.user";
    var KEY_PASS = "smarthome.mqtt.pass";
    var backdrop = null;

    function saved() {
        var u = localStorage.getItem(KEY_USER);
        var p = localStorage.getItem(KEY_PASS);
        return (u && p) ? { user: u, pass: p } : null;
    }

    function store(user, pass, remember) {
        if (remember) {
            localStorage.setItem(KEY_USER, user);
            localStorage.setItem(KEY_PASS, pass);
        } else {
            forget();
        }
    }

    function forget() {
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem(KEY_PASS);
    }

    function require(callback) {
        var creds = saved();
        if (creds) {
            callback(creds);
            return;
        }
        whenBodyReady(function () { show(callback); });
    }

    function whenBodyReady(fn) {
        if (document.body) {
            fn();
        } else {
            document.addEventListener("DOMContentLoaded", fn);
        }
    }

    function injectStyle() {
        if (document.getElementById("sh-auth-style")) return;
        var style = document.createElement("style");
        style.id = "sh-auth-style";
        style.textContent = [
            ".sh-auth-backdrop{position:fixed;inset:0;z-index:10000;display:flex;",
            "align-items:center;justify-content:center;background:rgba(20,26,34,.72);",
            "backdrop-filter:blur(2px);font-family:'Lato',Helvetica,Arial,sans-serif}",
            ".sh-auth-card{background:#fff;color:#34495e;border-radius:6px;padding:24px 26px;",
            "width:320px;max-width:92vw;box-shadow:0 12px 40px rgba(0,0,0,.4)}",
            ".sh-auth-card h2{margin:0 0 4px;font-size:22px;font-weight:400}",
            ".sh-auth-sub{margin:0 0 18px;font-size:13px;color:#7f8c8d}",
            ".sh-auth-card label{display:block;font-size:13px;margin-bottom:12px;color:#7f8c8d}",
            ".sh-auth-card input[type=text],.sh-auth-card input[type=password]{",
            "display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:8px 10px;",
            "font-size:15px;border:1px solid #d4d9de;border-radius:4px;color:#34495e}",
            ".sh-auth-card input:focus{outline:none;border-color:#1abc9c}",
            ".sh-auth-remember{display:flex !important;align-items:center;gap:8px;",
            "font-size:13px;color:#34495e !important}",
            ".sh-auth-remember input{margin:0}",
            ".sh-auth-error{min-height:18px;font-size:12px;color:#e74c3c;margin-bottom:8px}",
            ".sh-auth-card button{width:100%;padding:10px;font-size:15px;border:0;",
            "border-radius:4px;background:#1abc9c;color:#fff;cursor:pointer}",
            ".sh-auth-card button:hover{background:#16a085}",
            ".sh-auth-foot{margin:12px 0 0;font-size:11px;color:#b0b7bd;text-align:center}"
        ].join("");
        document.head.appendChild(style);
    }

    function show(callback) {
        if (backdrop) return;
        injectStyle();

        backdrop = document.createElement("div");
        backdrop.className = "sh-auth-backdrop";
        backdrop.innerHTML = [
            '<form class="sh-auth-card" autocomplete="on">',
            '<h2>Sign in</h2>',
            '<p class="sh-auth-sub">Unlock ',
            (MQTT_CONFIG && MQTT_CONFIG.appName ? MQTT_CONFIG.appName : "this page"),
            '</p>',
            '<label>User<input type="text" name="u" autocomplete="username"',
            ' autocapitalize="none" autocorrect="off" spellcheck="false"></label>',
            '<label>Password<input type="password" name="p" autocomplete="current-password"></label>',
            '<label class="sh-auth-remember"><input type="checkbox" name="r" checked>',
            ' Remember on this device</label>',
            '<div class="sh-auth-error" role="alert"></div>',
            '<button type="submit">Connect</button>',
            '<p class="sh-auth-foot">Stored in this browser only. Ask the house admin for the login.</p>',
            '</form>'
        ].join("");

        var form = backdrop.querySelector("form");
        var error = backdrop.querySelector(".sh-auth-error");
        var userField = form.elements.u;

        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            var user = form.elements.u.value.trim();
            var pass = form.elements.p.value;
            if (!user || !pass) {
                error.textContent = "Enter both user and password.";
                return;
            }
            store(user, pass, form.elements.r.checked);
            close();
            callback({ user: user, pass: pass });
        });

        document.body.appendChild(backdrop);
        userField.focus();
    }

    function close() {
        if (backdrop && backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
        }
        backdrop = null;
    }

    return {
        require: require,
        forget: forget,
        close: close
    };
})();
