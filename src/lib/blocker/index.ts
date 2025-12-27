/**
 * Unified blocker interface that selects the right implementation
 * based on browser capabilities (DNR for Chrome MV3, webRequest for Firefox MV2)
 */

import * as dnr from "./dnr";
import * as webRequest from "./webRequest";

// Detect if we're in MV3 (Chrome) or MV2 (Firefox)
// In MV3, declarativeNetRequest API exists and works
// In MV2 Firefox, this API doesn't exist
const hasDNR = typeof browser !== "undefined" && 
  "declarativeNetRequest" in browser &&
  typeof browser.declarativeNetRequest?.getDynamicRules === "function";

const hasWebRequestBlocking = typeof browser !== "undefined" &&
  "webRequest" in browser &&
  browser.webRequest?.onBeforeRequest !== undefined;

// Prefer DNR if available (Chrome MV3), fall back to webRequest (Firefox MV2)
const isMV3 = hasDNR;

console.log(`[distacted] Browser detection:`, {
  hasDNR,
  hasWebRequestBlocking,
  usingMV3: isMV3,
});
console.log(`[distacted] Using ${isMV3 ? "DNR (MV3)" : "webRequest (MV2)"} blocker`);

/**
 * Initialize the blocker
 */
export async function initializeBlocker(): Promise<void> {
  if (isMV3) {
    await dnr.initializeDnr();
  } else {
    await webRequest.initializeWebRequest();
  }
}

/**
 * Sync blocking rules with storage
 */
export async function syncRules(): Promise<void> {
  if (isMV3) {
    await dnr.syncDnrRules();
  } else {
    await webRequest.syncRules();
  }
}

/**
 * Grant temporary access to a site
 */
export async function grantAccess(
  siteId: string,
  durationMinutes: number | null
): Promise<{ expiresAt: number }> {
  if (isMV3) {
    return dnr.grantAccess(siteId, durationMinutes);
  } else {
    return webRequest.grantAccess(siteId, durationMinutes);
  }
}

/**
 * Revoke access to a site
 */
export async function revokeAccess(siteId: string): Promise<number[]> {
  if (isMV3) {
    return dnr.revokeAccess(siteId);
  } else {
    return webRequest.revokeAccess(siteId);
  }
}

/**
 * Check if a site is currently unlocked
 */
export async function isSiteUnlocked(siteId: string): Promise<boolean> {
  if (isMV3) {
    return dnr.isSiteUnlocked(siteId);
  } else {
    return webRequest.isSiteUnlocked(siteId);
  }
}

/**
 * Get unlock state for a site
 */
export async function getUnlockState(
  siteId: string
): Promise<{ siteId: string; expiresAt: number } | null> {
  if (isMV3) {
    return dnr.getUnlockState(siteId);
  } else {
    return webRequest.getUnlockState(siteId);
  }
}

/**
 * Handle relock alarm
 */
export async function handleRelockAlarm(alarmName: string): Promise<{
  siteId: string;
  tabsToRedirect: number[];
} | null> {
  if (isMV3) {
    return dnr.handleRelockAlarm(alarmName);
  } else {
    return webRequest.handleRelockAlarm(alarmName);
  }
}

/**
 * Find tabs on a blocked site
 */
export async function findTabsOnBlockedSite(siteId: string): Promise<number[]> {
  if (isMV3) {
    return dnr.findTabsOnBlockedSite(siteId);
  } else {
    return webRequest.findTabsOnBlockedSite(siteId);
  }
}

// Re-export the isMV3 flag for conditional logic elsewhere
export { isMV3 };
