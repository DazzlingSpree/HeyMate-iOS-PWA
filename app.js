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
            timeDisplay.innerText = `${days}d ${hours}h ${minutes}m remaining`;
        }
    }, 1000);
}

/* ==========================================================================
   2. HARDWARE CAMERA ACCESS (AR/IR Fallback for Web)
   ========================================================================== */
const videoElement = document.getElementById('camera-feed');
let mediaStream = null;

async function initCamera() {
    try {
        // Request the environment (back) camera on iOS at 4K resolution
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 3840 },  // Request 4K width
                height: { ideal: 2160 }  // Request 4K height
            },
            audio: false
        });
        videoElement.srcObject = mediaStream;
    } catch (err) {
        console.error("Camera access denied or unavailable", err);
        alert("Please enable camera permissions to use HeyMate.");
    }
}

/* ==========================================================================
   3. CONTROLS (Night Mode & Exposure)
   ========================================================================== */
function initControls() {
    const btnIr = document.getElementById('btn-ir');
    const btnExposure = document.getElementById('btn-exposure');
    const btnCapture = document.getElementById('btn-capture');

    let irMode = false;
    let exposureMode = false;

    // Toggle Simulated Night Vision
    btnIr.addEventListener('click', () => {
        irMode = !irMode;
        btnIr.innerText = `Night Mode: ${irMode ? 'ON' : 'OFF'}`;
        updateVideoFilters(irMode, exposureMode);
    });

    // Toggle High Exposure
    btnExposure.addEventListener('click', () => {
        exposureMode = !exposureMode;
        btnExposure.innerText = `Exp: ${exposureMode ? 'HIGH' : 'AUTO'}`;
        updateVideoFilters(irMode, exposureMode);
    });

    // Capture & Save Photo locally
    btnCapture.addEventListener('click', captureAndSavePhoto);
}

function updateVideoFilters(ir, exposure) {
    videoElement.className = '';
    if (ir) videoElement.classList.add('night-vision-filter');
    if (exposure) videoElement.classList.add('exposure-filter');
}

/* ==========================================================================
   4. LOCAL SECURE SAVING (Saving to iOS Photos)
   ========================================================================== */
async function captureAndSavePhoto() {
    if (!mediaStream) return;

    // Create a temporary canvas to draw the video frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');

    // Draw the current video frame
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Convert canvas to Blob (JPEG)
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `HeyMate_${Date.now()}.jpg`, { type: 'image/jpeg' });

        // Use iOS Web Share API to prompt native "Save Image" to local camera roll
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Save Photo',
                });
            } catch (err) {
                console.log("User cancelled share or error:", err);
            }
        } else {
            // Fallback for older browsers (direct download link)
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }, 'image/jpeg', 0.95);
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