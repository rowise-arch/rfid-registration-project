(function () {
    const API = "../src/php/get_user_by_rfid.php";
    const WS_SERVER = "ws://localhost:8765";

    const input = document.getElementById("rfid-capture");
    const msgEl = document.getElementById("monitorMsg");
    const rfidCodeEl = document.getElementById("rfidCode");
    const photoEl = document.getElementById("personPhoto");
    const nameEl = document.getElementById("personName");
    const roleEl = document.getElementById("personRole");
    const deptEl = document.getElementById("personDept");
    const courseEl = document.getElementById("personCourse");
    const contactEl = document.getElementById("personContact");
    const validityBadge = document.getElementById("validityBadge");
    const validityDate = document.getElementById("validityDate");
    const focusBtn = document.getElementById("focusReaderBtn");
    const clearBtn = document.getElementById("clearMonitorBtn");

    let ws = null;
    let isConnected = false;

    // Initialize WebSocket connection
    function initializeWebSocket() {
        try {
            ws = new WebSocket(WS_SERVER);

            ws.onopen = function () {
                console.log('✅ Connected to RFID WebSocket server');
                isConnected = true;
                updateMonitorMessage('RFID Reader Connected - Ready for tap');
            };

            ws.onmessage = function (event) {
                handleRFIDMessage(event.data);
            };

            ws.onclose = function () {
                console.log('❌ Disconnected from RFID server');
                isConnected = false;
                updateMonitorMessage('RFID Reader Disconnected - Attempting to reconnect...');
                // Attempt reconnect after 3 seconds
                setTimeout(initializeWebSocket, 3000);
            };

            ws.onerror = function (error) {
                console.error('WebSocket error:', error);
                updateMonitorMessage('RFID Reader Connection Error');
            };

        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            updateMonitorMessage('RFID Server Not Running - Using manual input only');
        }
    }

    function handleRFIDMessage(message) {
        console.log('RFID Reader:', message);

        // Handle different message types from the Python server
        if (message === "No reader found") {
            updateMonitorMessage('No RFID Reader Hardware Detected');
            return;
        }

        if (message === "Error reading card") {
            updateMonitorMessage('Error Reading RFID Card - Try Again');
            return;
        }

        if (message === "Waiting for card...") {
            // Card was removed, keep current display but update message
            updateMonitorMessage('Card Removed - Ready for Next Tap');
            return;
        }

        if (message.startsWith("Reader error:")) {
            updateMonitorMessage(`Reader Error: ${message.substring(13)}`);
            return;
        }

        // Valid RFID UID received - process it
        if (message && message.length > 0) {
            processRFIDInput(message);
        }
    }

    function focusCapture() {
        input.value = "";
        input.focus();
        if (isConnected) {
            updateMonitorMessage('RFID Reader Ready - Also accepting manual input');
        } else {
            updateMonitorMessage('Manual Input Ready - Type RFID and press Enter');
        }
    }

    function clearDisplay() {
        rfidCodeEl.textContent = "RFID: —";
        nameEl.textContent = "No user";
        roleEl.textContent = "Role — —";
        deptEl.textContent = "Department: —";
        courseEl.textContent = "Course/Position: —";
        contactEl.textContent = "Contact: —";
        validityBadge.textContent = "—";
        validityBadge.className = "notfound";
        validityDate.textContent = "Valid until —";
        updateMonitorMessage('Display cleared - Ready for RFID tap');
        photoEl.src = "";
        photoEl.style.display = "none";
    }

    function processRFIDInput(rfid) {
        // Clear previous display but keep the new RFID code visible
        rfidCodeEl.textContent = `RFID: ${rfid}`;
        updateMonitorMessage(`Processing RFID: ${rfid}`);
        fetchUserByRFID(rfid);
    }

    // In rfid_monitor.js, update the validity check section:
    function renderUser(d) {
        rfidCodeEl.textContent = `RFID: ${d.rfid || "—"}`;
        nameEl.textContent = `${d.first_name || ""} ${d.middle_initial || ""} ${d.last_name || ""}`.trim();
        roleEl.textContent = (d.role || "—").toUpperCase();
        deptEl.textContent = "Department: " + (d.department || "—");
        courseEl.textContent = "Course/Position: " + (d.course_or_position || "—");
        contactEl.textContent = "Contact: " + (d.contact_number || "—");

        if (d.photo) {
            photoEl.src = d.photo.startsWith("data:") ? d.photo : d.photo;
            photoEl.style.display = "block";
        } else {
            photoEl.style.display = "none";
        }

        // --- Validity Check using created_at ---
        const today = new Date();
        const created = new Date(d.created_at);
        const oneYearFromCreation = new Date(created);
        oneYearFromCreation.setFullYear(oneYearFromCreation.getFullYear() + 1);

        const valid = !isNaN(oneYearFromCreation) && oneYearFromCreation >= today;

        validityBadge.textContent = valid ? "Valid" : "Expired";
        validityBadge.className = valid ? "valid" : "expired";
        validityDate.textContent = d.created_at ? `Registered: ${d.created_at.split(' ')[0]}` : "No registration date";
        updateMonitorMessage(valid ? "✅ ID is valid." : "❌ ALERT: ID expired!");
    }

    async function fetchUserByRFID(rfid) {
        try {
            updateMonitorMessage("Looking up user information...");
            const res = await fetch(API + "?rfid=" + encodeURIComponent(rfid), { cache: "no-store" });
            const data = await res.json();

            if (!data || !data.rfid) {
                updateMonitorMessage("RFID not registered in database.");
                rfidCodeEl.textContent = `RFID: ${rfid}`;
                validityBadge.textContent = "Not Registered";
                validityBadge.className = "notfound";
                photoEl.style.display = "none";

                // Clear user info but keep RFID displayed
                nameEl.textContent = "User Not Found";
                roleEl.textContent = "Unregistered";
                deptEl.textContent = "Department: —";
                courseEl.textContent = "Course/Position: —";
                contactEl.textContent = "Contact: —";
                validityDate.textContent = "Not registered in system";
                return;
            }

            renderUser(data);
        } catch (err) {
            console.error(err);
            updateMonitorMessage("Database connection error.");
        }
    }

    function updateMonitorMessage(message) {
        msgEl.textContent = message;
    }

    // --- Event Listeners ---

    // Handle manual RFID input (keyboard-like input)
    input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
            const code = input.value.trim();
            if (code) {
                processRFIDInput(code);
                input.value = "";
            }
            ev.preventDefault();
        }
    });

    focusBtn.addEventListener("click", focusCapture);
    clearBtn.addEventListener("click", clearDisplay);

    // Initialize everything when page loads
    window.addEventListener("load", function () {
        // Initialize WebSocket connection to RFID server
        initializeWebSocket();

        // Auto-focus input after short delay
        setTimeout(focusCapture, 500);
    });

})();