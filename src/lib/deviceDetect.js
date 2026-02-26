/**
 * Device & performance detection utility.
 *
 * Instead of relying purely on the User-Agent (which "Request Desktop Site"
 * overrides), we also check hardware signals like touch support, screen size,
 * device memory, and CPU core count.
 */

// 1. Classic UA sniff (still useful for normal mobile browsing)
const uaIsMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// 2. Hardware / capability signals that survive "Request Desktop Site"
const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const smallScreen = Math.min(window.screen.width, window.screen.height) <= 500;
const mediumScreen = Math.min(window.screen.width, window.screen.height) <= 1024;
const lowMemory = navigator.deviceMemory ? navigator.deviceMemory <= 4 : false;
const fewCores = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false;

// A device is "mobile-like" if the UA says so, OR if it has a touch screen AND a
// small/medium physical display (catches "Desktop site" mode on phones/tablets).
export const isMobile = uaIsMobile || (hasTouch && mediumScreen);

// A device is "low-end" if it's mobile-like AND has limited hardware.
export const isLowEnd = isMobile && (lowMemory || fewCores);

// Pixel ratio clamped for performance — mobile devices often have 3x+ DPR
// which is way too expensive for WebGL
export const safeDpr = isMobile
    ? Math.min(window.devicePixelRatio, 1.5)
    : Math.min(window.devicePixelRatio, 2);

console.log('[Sunflower] Device detection →', {
    uaIsMobile,
    hasTouch,
    screenMin: Math.min(window.screen.width, window.screen.height),
    lowMemory,
    fewCores,
    isMobile,
    isLowEnd,
    dpr: window.devicePixelRatio,
    safeDpr,
});
