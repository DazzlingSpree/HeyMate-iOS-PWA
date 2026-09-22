# HeyMate (iOS PWA Edition)

A completely offline, secure, spoof-resistant iOS Progressive Web App (PWA) designed to act as a standalone camera utility and time-tracker.

This project uses modern web APIs to deliver a native app experience on iPhones, directly from the browser, without needing App Store approval.

## 🚀 Features

* **100% Offline Capable:** Built with a Service Worker (`sw.js`). Once loaded the first time, it caches all code locally. You can use it in Airplane mode forever.
* **Spoof-Resistant Time Tracking:** The time-remaining engine ignores the system calendar (which can be manipulated by the user) and relies on an internal differential tracking algorithm.
* **Native iOS Installation:** Includes a custom Safari popup that intelligently detects if the user is in the browser and guides them to "Add to Home Screen". The prompt auto-hides once installed.
* **4K Camera Access:** Requests the highest available resolution (up to 3840x2160) from the iPhone's rear camera.
* **Local Photo Saving:** Uses the native iOS Web Share API to save captured JPEGs directly to the iPhone's Camera Roll.
* **Simulated Hardware Modes:** Since Apple restricts true AR/IR access via the web, this app utilizes advanced CSS filtering to simulate "Night Vision" (IR) and "High Exposure" hardware modes on the live camera feed.

## 📁 File Structure

* `index.html` - The core UI, pre-configured with Apple specific meta tags for full-screen PWA mode.
* `app.js` - Contains the secure time-tracking logic, camera initialization, image capturing, and Safari install prompt logic.
* `style.css` - A dark-mode, mobile-first stylesheet featuring the digital camera filters.
* `sw.js` - The Service Worker that handles offline caching.
* `manifest.json` - Defines the app name, colors, and forces the "standalone" display mode.
* `icon.png` - **[USER PROVIDED]** The 512x512 app icon that appears on the iOS home screen.

## 🛠️ How to Deploy & Install

1. **Add an Icon:** Ensure you place a square 512x512 PNG file named `icon.png` in the root of this directory.
2. **Host the Files:** Upload this folder to any static web host with HTTPS enabled (e.g., GitHub Pages, Vercel, Netlify). *Note: HTTPS is strictly required for the camera and Service Worker to function.*
3. **Install on iOS:**
   * Open Safari on an iPhone and navigate to your hosted URL.
   * A prompt will appear at the bottom of the screen.
   * Tap the **Share** button in Safari.
   * Scroll down and tap **"Add to Home Screen"**.
   * Open the app from your home screen for the full, full-screen offline experience.

## ⚠️ Known Limitations (iOS WebKit)

* **Bluetooth (BLE):** Apple blocks the Web Bluetooth API on iPhones. This PWA cannot communicate with external hardware glasses (like the Android counterpart). It uses the iPhone camera instead.
* **Hardware Sensors:** True Infrared and LiDAR are not accessible via Safari. The app uses digital filters as a fallback.