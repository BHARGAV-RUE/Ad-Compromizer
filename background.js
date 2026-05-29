let primaryTabId = null;

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

chrome.contextMenus.onClicked.addListener((info, tab) => {

  if (!tab || !tab.id) return;

  const tabId = tab.id;

  if (info.menuItemId === "setPrimary") {

    chrome.storage.local.set({
      primaryTabId: tabId
    });

    console.log("Primary Tab Set:", tabId);

  }

  if (info.menuItemId === "enableProtection") {

    chrome.storage.local.set({
      protectionEnabled: true
    });

    console.log("Protection Enabled");

  }

  if (info.menuItemId === "disableProtection") {

    chrome.storage.local.set({
      protectionEnabled: false
    });

    console.log("Protection Disabled");

  }

  if (info.menuItemId === "clearOthers") {

    clearAllExceptPrimary();

  }

});

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