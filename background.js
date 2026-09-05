// ==========================================
// EXTENSION INSTALLED
// ==========================================
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "setPrimary",
    title: "Set as Primary Tab",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "enableProtection",
    title: "Enable Protection",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "disableProtection",
    title: "Disable Protection",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "clearRedirects",
    title: "Clear Redirect Tabs",
    contexts: ["page"]
  });
});

// ==========================================
// SET / REMOVE PRIMARY TAB
// ==========================================
function togglePrimaryTab(tabId) {
  chrome.storage.local.get(["primaryTabId","protectionEnabled"], (data) => {
    // ------------------------------------------
    // REMOVE PRIMARY
    // ------------------------------------------
    if (data.primaryTabId === tabId) {
      chrome.storage.local.set({
        primaryTabId: null,
        lastLegitimateUrl: null,
        redirectCount: 0,
        redirectTabs: [],
        protectionEnabled: false,
        restoringPrimary: false
      });
      restoringTabs.delete(tabId);
      redirectChainTabs.delete(tabId);
      console.log("Primary tab removed.");
      return;
    }
    // ------------------------------------------
    // SET NEW PRIMARY
    // ------------------------------------------
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        return;
      }
      chrome.storage.local.set({
        primaryTabId: tabId,
        lastLegitimateUrl: tab.url || "",
        redirectCount: 0,
        redirectTabs: [],
        restoringPrimary: false
      }, () => {
        console.log("Primary Tab:", tabId);
        console.log("Last legitimate URL:", tab.url);
      });
    });
  });
}

// ==========================================
// ENABLE PROTECTION
// ==========================================
function enableProtection() {
  chrome.storage.local.get("primaryTabId", (data) => {
    if (data.primaryTabId === undefined || data.primaryTabId === null) {
      console.log("Cannot enable protection: no primary tab.");
      return;
    }
    chrome.storage.local.set({
      protectionEnabled: true
    });
    console.log("Protection Enabled.");
  });
}

// ==========================================
// DISABLE PROTECTION
// ==========================================
function disableProtection() {
  chrome.storage.local.set({
    protectionEnabled: false
  });
  console.log("Protection Disabled.");
}

// ==========================================
// CONTEXT MENU ACTIONS
// ==========================================
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || tab.id === undefined) {
    return;
  }
  const tabId = tab.id;
  if (info.menuItemId === "setPrimary") {
    togglePrimaryTab(tabId);
  }
  if (info.menuItemId === "enableProtection") {
    enableProtection();
  }
  if (info.menuItemId === "disableProtection") {
    disableProtection();
  }
  if (info.menuItemId === "clearRedirects") {
    clearEvilRedirectTabs();
  }
});

// ==========================================
// PRIMARY TAB NAVIGATION STATE
// ==========================================
// restoringTabs: tabId -> { targetUrl, attempts }
// Presence in this map means "we are actively forcing this tab back
// to targetUrl" — used to swallow chain hops and confirm real recovery.
const restoringTabs = new Map();
const primaryNavigationState = new Map();

// redirectChainTabs: tabId -> timestamp of last observed HTTP redirect hop
// (from webRequest.onBeforeRedirect). Used as a second, independent signal
// for "this navigation is part of a redirect", since webNavigation's
// transitionQualifiers miss many real-world ad redirects (e.g. ones that
// piggyback on a click so Chrome tags them as an ordinary "link" transition).
const redirectChainTabs = new Map();
const REDIRECT_CHAIN_WINDOW_MS = 4000;
const MAX_RESTORE_ATTEMPTS = 5;

// ==========================================
// TRACK HTTP-LEVEL REDIRECT CHAINS (server redirects)
// ==========================================
chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    if (details.type !== "main_frame") {
      return;
    }
    chrome.storage.local.get(["primaryTabId","protectionEnabled"], (data) => {
      if (data.primaryTabId === undefined || data.primaryTabId === null) {
        return;
      }
      if (details.tabId !== data.primaryTabId) {
        return;
      }
      if (!data.protectionEnabled) {
        return;
      }
      redirectChainTabs.set(details.tabId, Date.now());
    });
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

// ==========================================
// PRIMARY TAB NAVIGATION START
// ==========================================
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }
  chrome.storage.local.get(["primaryTabId","protectionEnabled"], (data) => {
    if (data.primaryTabId === undefined || data.primaryTabId === null) {
      return;
    }
    if (details.tabId !== data.primaryTabId) {
      return;
    }
    primaryNavigationState.set(details.tabId, {
      url: details.url,
      time: Date.now()
    });
  });
});

// ==========================================
// PRIMARY TAB NAVIGATION COMMITTED
// ==========================================
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }
  chrome.storage.local.get(["primaryTabId","protectionEnabled","lastLegitimateUrl","redirectCount"], (data) => {
    if (data.primaryTabId === undefined || data.primaryTabId === null) {
      return;
    }
    if (details.tabId !== data.primaryTabId) {
      return;
    }
    // ------------------------------------------
    // IGNORE INTERNAL CHROME PAGES
    // ------------------------------------------
    if (
      details.url.startsWith("chrome://") ||
      details.url.startsWith("chrome-extension://") ||
      details.url.startsWith("edge://") ||
      details.url.startsWith("about:")
    ) {
      return;
    }

    // ------------------------------------------
    // WE ARE MID-RESTORATION FOR THIS TAB
    // ------------------------------------------
    if (restoringTabs.has(details.tabId)) {
      const restoreInfo = restoringTabs.get(details.tabId);
      if (details.url === restoreInfo.targetUrl) {
        // Confirmed: we're actually back on the legitimate page.
        restoringTabs.delete(details.tabId);
        redirectChainTabs.delete(details.tabId);
        primaryNavigationState.set(details.tabId, {
          url: details.url,
          time: Date.now()
        });
        chrome.storage.local.set({ restoringPrimary: false });
        console.log("Primary page restored:", details.url);
      } else {
        // A stray hop from the same redirect chain committed instead
        // of our restoration (or it hasn't landed yet). Re-assert it,
        // bounded so a persistent hijacker can't loop us forever.
        restoreInfo.attempts = (restoreInfo.attempts || 0) + 1;
        if (restoreInfo.attempts > MAX_RESTORE_ATTEMPTS) {
          restoringTabs.delete(details.tabId);
          chrome.storage.local.set({ restoringPrimary: false });
          console.log("Restore attempts exceeded, giving up for this incident:", details.url);
        } else {
          chrome.tabs.update(details.tabId, { url: restoreInfo.targetUrl }, () => {
            chrome.runtime.lastError;
          });
        }
      }
      return;
    }

    // ------------------------------------------
    // CHECK WHETHER THIS WAS A REDIRECT
    // ------------------------------------------
    const qualifiers = details.transitionQualifiers || [];
    const hasRedirectQualifier =
      qualifiers.includes("server_redirect") ||
      qualifiers.includes("client_redirect");
    const chainTimestamp = redirectChainTabs.get(details.tabId);
    const inHttpRedirectChain =
      chainTimestamp !== undefined &&
      (Date.now() - chainTimestamp) <= REDIRECT_CHAIN_WINDOW_MS;
    const isRedirect = hasRedirectQualifier || inHttpRedirectChain;

    const previousNavigation = primaryNavigationState.get(details.tabId);
    const navigationAge = previousNavigation ? Date.now() - previousNavigation.time : Infinity;

    // ------------------------------------------
    // REDIRECT DETECTED
    // ------------------------------------------
    if (data.protectionEnabled && isRedirect && data.lastLegitimateUrl && data.lastLegitimateUrl !== details.url) {
      const count = (data.redirectCount || 0) + 1;
      chrome.storage.local.set({
        redirectCount: count,
        restoringPrimary: true
      });
      console.log("🚨 PRIMARY REDIRECT DETECTED");
      console.log("Redirected URL:", details.url);
      console.log("Restoring:", data.lastLegitimateUrl);
      console.log("Redirect count:", count);

      restoringTabs.set(details.tabId, {
        targetUrl: data.lastLegitimateUrl,
        attempts: 0
      });
      redirectChainTabs.delete(details.tabId);

      // Direct, deterministic restoration — does not depend on
      // session history, so it isn't defeated by location.replace()
      // chains that would break chrome.tabs.goBack().
      chrome.tabs.update(details.tabId, { url: data.lastLegitimateUrl }, () => {
        chrome.runtime.lastError;
      });
      return;
    }

    // ------------------------------------------
    // NORMAL / LEGITIMATE NAVIGATION
    // ------------------------------------------
    if (!isRedirect && navigationAge > 100) {
      chrome.storage.local.set({
        lastLegitimateUrl: details.url,
        restoringPrimary: false
      });
      primaryNavigationState.set(details.tabId, {
        url: details.url,
        time: Date.now()
      });
      redirectChainTabs.delete(details.tabId);
      console.log("✅ Legitimate primary navigation:", details.url);
    }
  });
});

// ==========================================
// TRACK HISTORY STATE CHANGES
// ==========================================
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }
  chrome.storage.local.get(["primaryTabId","protectionEnabled"], (data) => {
    if (data.primaryTabId === undefined || data.primaryTabId === null) {
      return;
    }
    if (details.tabId !== data.primaryTabId) {
      return;
    }
    if (!data.protectionEnabled) {
      chrome.storage.local.set({
        lastLegitimateUrl: details.url
      });
      return;
    }
    if (restoringTabs.has(details.tabId)) {
      return;
    }
    console.log("Primary history state changed:", details.url);
  });
});

// ==========================================
// TRACK NAVIGATION ERRORS
// ==========================================
chrome.webNavigation.onErrorOccurred.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }
  chrome.storage.local.get("primaryTabId", (data) => {
    if (data.primaryTabId !== details.tabId) {
      return;
    }
    console.log(
      "Primary navigation error:",
      details.url,
      details.error
    );
  });
});

// ==========================================
// TRACK NEW TABS CREATED BY PRIMARY TAB
// ==========================================
chrome.tabs.onCreated.addListener((tab) => {
  chrome.storage.local.get(["primaryTabId","protectionEnabled","redirectTabs"], (data) => {
    if (!data.protectionEnabled) {
      return;
    }
    if (data.primaryTabId === undefined || data.primaryTabId === null) {
      return;
    }
    // Only tabs opened by Primary are tracked.
    if (tab.openerTabId !== data.primaryTabId) {
      return;
    }
    const redirectTabs = data.redirectTabs || [];
    const alreadyTracked = redirectTabs.some(
      item => item.tabId === tab.id
    );
    if (!alreadyTracked) {
      redirectTabs.push({
        tabId: tab.id,
        url: tab.pendingUrl || "",
        status: "EVIL"
      });
      chrome.storage.local.set({
        redirectTabs: redirectTabs
      });
      console.log(
        "NEW REDIRECT TAB MARKED EVIL:",
        tab.id
      );
      // Chrome activates newly created tabs by default, which steals
      // focus away from the Primary Tab. Bounce focus back — this only
      // touches activation/focus, not the EVIL/NOT_EVIL tab itself.
      focusPrimaryTab(data.primaryTabId);
      // Some ad scripts re-grab focus right after opening (e.g. via a
      // second window.focus() call on their own tab). Re-assert once
      // more shortly after, in case the first attempt gets overridden.
      setTimeout(() => {
        focusPrimaryTab(data.primaryTabId);
      }, 300);
    }
  });
});

// ==========================================
// FOCUS PRIMARY TAB + ITS WINDOW
// ==========================================
function focusPrimaryTab(primaryTabId) {
  chrome.tabs.update(primaryTabId, { active: true }, () => {
    chrome.runtime.lastError;
  });
  chrome.tabs.get(primaryTabId, (primaryTab) => {
    if (chrome.runtime.lastError || !primaryTab) {
      return;
    }
    chrome.windows.update(primaryTab.windowId, { focused: true }, () => {
      chrome.runtime.lastError;
    });
  });
}

// ==========================================
// UPDATE REDIRECT TAB URL
// ==========================================
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }
  chrome.storage.local.get("redirectTabs", (data) => {
    const redirectTabs = data.redirectTabs || [];
    const tabIndex = redirectTabs.findIndex(
      item => item.tabId === details.tabId
    );
    if (tabIndex === -1) {
      return;
    }
    redirectTabs[tabIndex].url = details.url;
    chrome.storage.local.set({
      redirectTabs: redirectTabs
    });
    // Tell the page that it is an EVIL redirect tab.
    chrome.tabs.sendMessage(
      details.tabId,
      {
        type: "redirectStatus",
        status: redirectTabs[tabIndex].status
      },
      () => {
        // Ignore if content script is not ready.
        chrome.runtime.lastError;
      }
    );
  });
});

// ==========================================
// CONTENT SCRIPT READY
// ==========================================
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "contentReady") {
    return;
  }
  if (!sender.tab || sender.tab.id === undefined) {
    return;
  }
  const tabId = sender.tab.id;
  chrome.storage.local.get("redirectTabs", (data) => {
    const redirectTabs = data.redirectTabs || [];
    const redirectTab = redirectTabs.find(
      item => item.tabId === tabId
    );
    if (!redirectTab) {
      return;
    }
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "redirectStatus",
        status: redirectTab.status
      },
      () => {
        chrome.runtime.lastError;
      }
    );
  });
});

// ==========================================
// TOGGLE EVIL / NOT EVIL
// ==========================================
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "toggleRedirectStatus") {
    return;
  }
  if (!sender.tab || sender.tab.id === undefined) {
    return;
  }
  const tabId = sender.tab.id;
  chrome.storage.local.get("redirectTabs", (data) => {
    const redirectTabs = data.redirectTabs || [];
    const tabIndex = redirectTabs.findIndex(
      item => item.tabId === tabId
    );
    if (tabIndex === -1) {
      return;
    }
    if (redirectTabs[tabIndex].status === "EVIL") {
      redirectTabs[tabIndex].status = "NOT_EVIL";
    } else {
      redirectTabs[tabIndex].status = "EVIL";
    }
    chrome.storage.local.set({
      redirectTabs: redirectTabs
    });
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "redirectStatus",
        status: redirectTabs[tabIndex].status
      },
      () => {
        chrome.runtime.lastError;
      }
    );
    console.log(
      "Tab",
      tabId,
      "is now",
      redirectTabs[tabIndex].status
    );
  });
});

// ==========================================
// REMOVE CLOSED REDIRECT TABS
// ==========================================
chrome.tabs.onRemoved.addListener((tabId) => {
  restoringTabs.delete(tabId);
  redirectChainTabs.delete(tabId);
  primaryNavigationState.delete(tabId);
  chrome.storage.local.get("redirectTabs", (data) => {
    const redirectTabs = data.redirectTabs || [];
    const updatedTabs = redirectTabs.filter(
      item => item.tabId !== tabId
    );
    chrome.storage.local.set({
      redirectTabs: updatedTabs
    });
  });
});

// ==========================================
// CLEAR ONLY EVIL REDIRECT TABS
// ==========================================
function clearEvilRedirectTabs() {
  chrome.storage.local.get("redirectTabs", (data) => {
    const redirectTabs = data.redirectTabs || [];
    const remainingTabs = [];
    for (const item of redirectTabs) {
      if (item.status === "EVIL") {
        chrome.tabs.remove(
          item.tabId,
          () => {
            // Ignore already closed tabs.
            chrome.runtime.lastError;
          }
        );
      } else {
        remainingTabs.push(item);
      }
    }
    chrome.storage.local.set({
      redirectTabs: remainingTabs
    });
    console.log("EVIL redirect tabs cleared.");
  });
}