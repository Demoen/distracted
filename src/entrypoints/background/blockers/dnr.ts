/**
 * Declarative Net Request (DNR) based blocker for Chrome MV3
 *
 * This module manages DNR rules to intercept and redirect blocked URLs
 * to the extension's blocked page before they load.
 */

import {
  getBlockedSites,
  urlMatchesSiteRules,
  type BlockedSite,
} from "@/lib/storage";
import {
  RULE_ID_BASE,
  MAX_RULES_PER_SITE,
  UNLOCK_PREFIX,
  ALARM_PREFIX,
} from "@/lib/consts";
import { isInternalUrl } from "../utils";

interface UnlockState {
  siteId: string;
  expiresAt: number;
}

function patternToDnrFilter(pattern: string): string {
  let normalized = pattern
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");

  if (normalized.startsWith("*.")) {
    const domain = normalized.slice(2);
    return `||${domain}`;
  }

  return `||${normalized}`;
}

function getRuleId(siteIndex: number, patternIndex: number): number {
  return RULE_ID_BASE + siteIndex * MAX_RULES_PER_SITE + patternIndex;
}

function createSiteRules(
  site: BlockedSite,
  siteIndex: number
): Browser.declarativeNetRequest.Rule[] {
  if (!site.enabled) return [];

  const rules: Browser.declarativeNetRequest.Rule[] = [];
  const blockPatterns = site.rules.filter((r) => !r.allow);

  blockPatterns.forEach((rule, patternIndex) => {
    const regexFilter = urlFilterToRegex(patternToDnrFilter(rule.pattern));

    rules.push({
      id: getRuleId(siteIndex, patternIndex),
      priority: 1,
      action: {
        type: "block",
      },
      condition: {
        regexFilter,
        resourceTypes: ["main_frame"],
      },
    });
  });

  return rules;
}

/**
 * Convert a urlFilter-style pattern to a regex
 */
function urlFilterToRegex(urlFilter: string): string {
  let pattern = urlFilter.replace(/^\|\|/, "");
  pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  pattern = pattern.replace(/\*/g, ".*");
  return `^(https?://(www\\.)?${pattern}.*)$`;
}

export async function syncDnrRules(): Promise<void> {
  const sites = await getBlockedSites();
  const existingRules = await browser.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map((r) => r.id);
  const unlockedSiteIds = await getUnlockedSiteIds();

  const newRules: Browser.declarativeNetRequest.Rule[] = [];

  sites.forEach((site, index) => {
    if (!site.enabled) return;
    if (unlockedSiteIds.has(site.id)) return;

    const siteRules = createSiteRules(site, index);
    newRules.push(...siteRules);
  });

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRuleIds,
    addRules: newRules,
  });

  console.log(
    `[distacted] DNR rules synced: ${newRules.length} rules for ${sites.filter((s) => s.enabled).length} sites`
  );
}

async function getUnlockedSiteIds(): Promise<Set<string>> {
  const session = await browser.storage.session.get();
  const unlockedIds = new Set<string>();
  const now = Date.now();

  for (const [key, value] of Object.entries(session)) {
    if (key.startsWith(UNLOCK_PREFIX)) {
      const state = value as UnlockState;
      if (state.expiresAt > now) {
        unlockedIds.add(state.siteId);
      }
    }
  }

  return unlockedIds;
}

export async function grantAccess(
  siteId: string,
  durationMinutes: number | null
): Promise<{ expiresAt: number }> {
  const durationMs = (durationMinutes ?? 60) * 60 * 1000;
  const expiresAt = Date.now() + durationMs;

  const state: UnlockState = { siteId, expiresAt };
  await browser.storage.session.set({
    [`${UNLOCK_PREFIX}${siteId}`]: state,
  });

  await syncDnrRules();

  const alarmName = `${ALARM_PREFIX}${siteId}`;
  await browser.alarms.create(alarmName, {
    when: expiresAt,
  });

  console.log(
    `[distacted] Granted access to site ${siteId} for ${durationMinutes ?? 60} minutes`
  );

  return { expiresAt };
}

export async function revokeAccess(siteId: string): Promise<number[]> {
  await browser.storage.session.remove(`${UNLOCK_PREFIX}${siteId}`);
  await browser.alarms.clear(`${ALARM_PREFIX}${siteId}`);
  await syncDnrRules();
  const tabsToRedirect = await findTabsOnBlockedSite(siteId);

  console.log(
    `[distacted] Revoked access to site ${siteId}, ${tabsToRedirect.length} tabs to redirect`
  );

  return tabsToRedirect;
}

/**
 * Find all tabs that are currently on a blocked site
 */
export async function findTabsOnBlockedSite(siteId: string): Promise<number[]> {
  const sites = await getBlockedSites();
  const site = sites.find((s) => s.id === siteId);
  if (!site) return [];

  const tabs = await browser.tabs.query({});
  const matchingTabIds: number[] = [];

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    // Skip extension pages and internal URLs
    if (isInternalUrl(tab.url)) continue;

    if (urlMatchesSiteRules(tab.url, site)) {
      matchingTabIds.push(tab.id);
    }
  }

  return matchingTabIds;
}

/**
 * Check if a site is currently unlocked
 */
export async function isSiteUnlocked(siteId: string): Promise<boolean> {
  const result = await browser.storage.session.get(`${UNLOCK_PREFIX}${siteId}`);
  const state = result[`${UNLOCK_PREFIX}${siteId}`] as UnlockState | undefined;

  if (!state) return false;
  if (state.expiresAt <= Date.now()) {
    await browser.storage.session.remove(`${UNLOCK_PREFIX}${siteId}`);
    return false;
  }

  return true;
}

export async function getUnlockState(
  siteId: string
): Promise<UnlockState | null> {
  const result = await browser.storage.session.get(`${UNLOCK_PREFIX}${siteId}`);
  const state = result[`${UNLOCK_PREFIX}${siteId}`] as UnlockState | undefined;

  if (!state) return null;
  if (state.expiresAt <= Date.now()) {
    await browser.storage.session.remove(`${UNLOCK_PREFIX}${siteId}`);
    return null;
  }

  return state;
}

export async function handleRelockAlarm(alarmName: string): Promise<{
  siteId: string;
  tabsToRedirect: number[];
} | null> {
  if (!alarmName.startsWith(ALARM_PREFIX)) return null;

  const siteId = alarmName.slice(ALARM_PREFIX.length);
  console.log(`[distacted] Relock alarm fired for site ${siteId}`);

  const tabsToRedirect = await revokeAccess(siteId);
  return { siteId, tabsToRedirect };
}

export async function initializeDnr(): Promise<void> {
  const session = await browser.storage.session.get();
  const now = Date.now();

  for (const [key, value] of Object.entries(session)) {
    if (key.startsWith(UNLOCK_PREFIX)) {
      const state = value as UnlockState;
      if (state.expiresAt <= now) {
        await browser.storage.session.remove(key);
        await browser.alarms.clear(`${ALARM_PREFIX}${state.siteId}`);
      }
    }
  }

  await syncDnrRules();
}

export async function clearAllRules(): Promise<void> {
  const existingRules = await browser.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map((r) => r.id);

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRuleIds,
  });

  console.log("[distacted] Cleared all DNR rules");
}
