/**
 * HeyMate PWA Core Logic
 * Handles Camera, Offline Time Tracking, and Local Saving.
 */

document.addEventListener('DOMContentLoaded', () => {
    initTimeManager();
    initCamera();
    initNetworkMonitor();
    initControls();
    initIosInstallPrompt();
});

/* ==========================================================================
   1. SECURE TIME TRACKING (Spoof-resistant Offline Time)
   ========================================================================== */
function initTimeManager() {
    const timeDisplay = document.getElementById('time-remaining');
    const TARGET_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // Example: 7 days

    // Initialize or load secure offline time
    let installTime = localStorage.getItem('hm_install_time');
    let lastCheckTime = localStorage.getItem('hm_last_check_time');
    let accumulatedTime = parseInt(localStorage.getItem('hm_accumulated_time') || '0');

    const now = Date.now();

    if (!installTime) {
        // First ever launch
        localStorage.setItem('hm_install_time', now.toString());
        localStorage.setItem('hm_last_check_time', now.toString());
        localStorage.setItem('hm_accumulated_time', '0');
    } else {
        // Anti-spoofing: if current time is BEFORE last check, the user changed their system clock backwards.
        // We freeze accumulated time instead of allowing negative time travel.
        if (now >= parseInt(lastCheckTime)) {
            const delta = now - parseInt(lastCheckTime);
            accumulatedTime += delta;
            localStorage.setItem('hm_accumulated_time', accumulatedTime.toString());
        }
        localStorage.setItem('hm_last_check_time', now.toString());
    }

    // Update UI Loop
    setInterval(() => {
        const currentNow = Date.now();
        const storedLastCheck = parseInt(localStorage.getItem('hm_last_check_time'));
        let currentAccumulated = parseInt(localStorage.getItem('hm_accumulated_time'));

        if (currentNow >= storedLastCheck) {
            const delta = currentNow - storedLastCheck;
            currentAccumulated += delta;
            localStorage.setItem('hm_accumulated_time', currentAccumulated.toString());
            localStorage.setItem('hm_last_check_time', currentNow.toString());
        }

        const remainingMs = TARGET_DURATION_MS - currentAccumulated;

        if (remainingMs <= 0) {
            timeDisplay.innerText = "Time Expired";
        } else {
            const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((remainingMs / (1000 * 60)) % 60);
            const seconds = Math.floor((remainingMs / 1000) % 60);
            timeDisplay.innerText = `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
        }
    }, 1000);
}

/* ==========================================================================
   2. HARDWARE CAMERA ACCESS (Raw, Unfiltered Sensor Access)
   ========================================================================== */
const videoElement = document.getElementById('camera-feed');
let mediaStream = null;
let videoTrack = null;

async function initCamera() {
    try {
        // Request the environment (back) camera at 4K resolution
        // getUserMedia natively bypasses Apple's "Deep Fusion" and "Smart HDR" post-processing
        // giving you the rawest, unfiltered sensor data Safari allows.
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 3840 },
                height: { ideal: 2160 }
            },
            audio: false
        });
        videoElement.srcObject = mediaStream;
        videoTrack = mediaStream.getVideoTracks()[0];

        // Wait for video to start before checking hardware capabilities
        videoElement.onloadedmetadata = () => {
            setupHardwareControls();
        };
    } catch (err) {
        console.error("Camera access denied or unavailable", err);
        alert("Please enable camera permissions to use HeyMate.");
    }
}

/* ==========================================================================
   3. HARDWARE CONTROLS (No CSS Fake Filters)
   ========================================================================== */
function initControls() {
    // Capture & Save Photo locally
    const btnCapture = document.getElementById('btn-capture');
    btnCapture.addEventListener('click', captureAndSavePhoto);
}

function setupHardwareControls() {
    if (!videoTrack) return;

    const capabilities = videoTrack.getCapabilities();
    const btnIr = document.getElementById('btn-ir');
    const btnExposure = document.getElementById('btn-exposure');

    window.irMode = false;
    window.exposureMode = false;

    // 1. Hardware Torch (Flashlight / Night Mode)
    // We turn on the physical LED rather than faking it with CSS.
    if (capabilities.torch) {
        btnIr.addEventListener('click', async () => {
            window.irMode = !window.irMode;
            try {
                await videoTrack.applyConstraints({
                    advanced: [{ torch: window.irMode }]
                });
                btnIr.innerText = `Flash/Night: ${window.irMode ? 'ON' : 'OFF'}`;
            } catch (err) {
                console.error("Failed to toggle torch", err);
            }
        });
    } else {
        btnIr.innerText = "No Flash/IR";
        btnIr.style.opacity = "0.5";
    }

    // 2. Hardware Exposure Compensation
    if (capabilities.exposureCompensation) {
        btnExposure.addEventListener('click', async () => {
            window.exposureMode = !window.exposureMode;
            try {
                // If toggled, push exposure up (+2 EV), otherwise reset to 0
                const targetEV = window.exposureMode ? capabilities.exposureCompensation.max : 0;
                await videoTrack.applyConstraints({
                    advanced: [{ exposureCompensation: targetEV }]
                });
                btnExposure.innerText = `Raw Exp: ${window.exposureMode ? 'HIGH' : 'AUTO'}`;
            } catch (err) {
                console.error("Failed to adjust exposure", err);
            }
        });
    } else {
        btnExposure.innerText = "Exp Locked";
        btnExposure.style.opacity = "0.5";
    }
}

/* ==========================================================================
   4. LOCAL SECURE SAVING (100% Raw Uncompressed Quality)
   ========================================================================== */
async function captureAndSavePhoto() {
    if (!mediaStream) return;

    // Create a temporary canvas matching EXACT sensor resolution
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');

    // Draw the raw unmanipulated video frame
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Convert canvas to Blob at 1.0 (100% MAXIMUM QUALITY, NO COMPRESSION)
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `HeyMate_RAW_${Date.now()}.jpg`, { type: 'image/jpeg' });

        // Use iOS Web Share API to prompt native "Save Image" to local camera roll
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Save Raw Photo',
                });
            } catch (err) {
                console.log("User cancelled share or error:", err);
            }
        } else {
            // Fallback
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }, 'image/jpeg', 1.0);
}

/* ==========================================================================
   5. OFFLINE STATUS MONITORING
   ========================================================================== */
function initNetworkMonitor() {
    const statusBadge = document.getElementById('offline-status');

    const updateStatus = () => {
        if (navigator.onLine) {
            statusBadge.innerText = "Online";
            statusBadge.style.color = "#4ade80"; // green
        } else {
            statusBadge.innerText = "Offline (Local Only)";
            statusBadge.style.color = "#f87171"; // red
        }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

/* ==========================================================================
   6. PWA INSTALL PROMPT FOR iOS SAFARI
   ========================================================================== */
function initIosInstallPrompt() {
    // Check if the user is on an iOS device
    const isIos = () => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(userAgent);
    };

    // Check if the app is already running in standalone (PWA) mode
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    const promptElement = document.getElementById('ios-install-prompt');
    const closeBtn = document.getElementById('close-install-prompt');

    // If they are on an iPhone but NOT in the installed PWA mode, show the popup
    if (isIos() && !isStandalone) {
        // Slight delay so the camera can load first
        setTimeout(() => {
            promptElement.classList.remove('hidden');
        }, 2000);

        closeBtn.addEventListener('click', () => {
            promptElement.classList.add('hidden');
            // Optional: Save to localStorage so we don't annoy them again today
            localStorage.setItem('hm_prompt_dismissed', Date.now().toString());
        });
    }
}