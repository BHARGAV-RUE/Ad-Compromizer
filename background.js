let primaryTabId = null;


// ==========================================
// HANDLE MESSAGES FROM CONTENT SCRIPT
// ==========================================

chrome.runtime.onMessage.addListener((message, sender) => {

  if (message.type === "newWindowOpened") {

    chrome.storage.local.get("redirectCount", (data) => {

      const count = (data.redirectCount || 0) + 1;

      chrome.storage.local.set({
        redirectCount: count
      });

      console.log("Redirect Count:", count);

    });

  }

});


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
    id: "clearOthers",
    title: "Clear All Except Primary",
    contexts: ["page"]
  });

});


// ==========================================
// HANDLE NEW TABS
// ==========================================

chrome.tabs.onCreated.addListener((tab) => {

  chrome.storage.local.get(
    ["primaryTabId", "protectionEnabled"],
    (data) => {

      if (!data.protectionEnabled) return;

      if (tab.openerTabId === data.primaryTabId) {

        setTimeout(() => {

          chrome.tabs.update(data.primaryTabId, {
            active: true
          });

        }, 100);

      }

    }
  );

});


// ==========================================
// CONTEXT MENU ACTIONS
// ==========================================

chrome.contextMenus.onClicked.addListener((info, tab) => {

  if (!tab || !tab.id) return;

  const tabId = tab.id;


  // ------------------------------
  // SET PRIMARY TAB
  // ------------------------------

  if (info.menuItemId === "setPrimary") {

    chrome.storage.local.set({
      primaryTabId: tabId
    });

    console.log("Primary Tab Set:", tabId);

  }


  // ------------------------------
  // ENABLE PROTECTION
  // ------------------------------

  if (info.menuItemId === "enableProtection") {

    chrome.storage.local.set({
      protectionEnabled: true
    });

    console.log("Protection Enabled");

  }


  // ------------------------------
  // DISABLE PROTECTION
  // ------------------------------

  if (info.menuItemId === "disableProtection") {

    chrome.storage.local.set({
      protectionEnabled: false
    });

    console.log("Protection Disabled");

  }


  // ------------------------------
  // CLEAR OTHER TABS
  // ------------------------------

  if (info.menuItemId === "clearOthers") {

    clearAllExceptPrimary();

  }

});


// ==========================================
// CLEAR ALL TABS EXCEPT PRIMARY
// ==========================================

function clearAllExceptPrimary() {

  chrome.storage.local.get(
    "primaryTabId",
    (data) => {

      chrome.tabs.query({}, (tabs) => {

        for (const t of tabs) {

          if (t.id !== data.primaryTabId) {

            chrome.tabs.remove(t.id);

          }

        }

      });

    }
  );

}