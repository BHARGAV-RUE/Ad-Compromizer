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

  chrome.storage.local.get(
    [
      "primaryTabId",
      "protectionEnabled"
    ],
    (data) => {

      // ------------------------------------------
      // REMOVE PRIMARY
      // ------------------------------------------

      if (data.primaryTabId === tabId) {

        chrome.storage.local.set({
          primaryTabId: null,
          lastLegitimateUrl: null,
          redirectCount: 0,
          redirectTabs: [],
          protectionEnabled: false
        });

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
          redirectTabs: []
        }, () => {

          console.log("Primary Tab:", tabId);
          console.log(
            "Last legitimate URL:",
            tab.url
          );

        });

      });

    }
  );

}


// ==========================================
// ENABLE PROTECTION
// ==========================================

function enableProtection() {

  chrome.storage.local.get(
    "primaryTabId",
    (data) => {

      if (
        data.primaryTabId === undefined ||
        data.primaryTabId === null
      ) {

        console.log(
          "Cannot enable protection: no primary tab."
        );

        return;
      }

      chrome.storage.local.set({
        protectionEnabled: true
      });

      console.log("Protection Enabled.");

    }
  );

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

chrome.contextMenus.onClicked.addListener(
  (info, tab) => {

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

  }
);


// ==========================================
// PRIMARY TAB NAVIGATION
// ==========================================

chrome.webNavigation.onCommitted.addListener(
  (details) => {

    if (details.frameId !== 0) {
      return;
    }

    chrome.storage.local.get(
      [
        "primaryTabId",
        "protectionEnabled",
        "lastLegitimateUrl",
        "redirectCount"
      ],
      (data) => {

        if (
          data.primaryTabId === undefined ||
          data.primaryTabId === null
        ) {
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
        // CHECK WHETHER THIS WAS A REDIRECT
        // ------------------------------------------

        const qualifiers =
          details.transitionQualifiers || [];

        const isRedirect =
          qualifiers.includes("server_redirect") ||
          qualifiers.includes("client_redirect");


        // ------------------------------------------
        // REDIRECT DETECTED
        // ------------------------------------------

        if (
          data.protectionEnabled &&
          isRedirect
        ) {

          const count =
            (data.redirectCount || 0) + 1;


          chrome.storage.local.set({
            redirectCount: count
          });


          console.log(
            "PRIMARY REDIRECT DETECTED:",
            details.url
          );

          console.log(
            "Redirect count:",
            count
          );


          // ----------------------------------------
          // RESTORE LAST LEGITIMATE PAGE
          // ----------------------------------------

          if (
            data.lastLegitimateUrl &&
            data.lastLegitimateUrl !== details.url
          ) {

            chrome.storage.local.set({
              restoringPrimary: true
            });


            chrome.tabs.update(
              details.tabId,
              {
                url: data.lastLegitimateUrl
              },
              () => {

                if (chrome.runtime.lastError) {

                  console.log(
                    "Could not restore primary tab:",
                    chrome.runtime.lastError.message
                  );

                }

              }
            );

          }

          return;
        }


        // ------------------------------------------
        // NORMAL / LEGITIMATE NAVIGATION
        // ------------------------------------------

        if (!data.restoringPrimary) {

          chrome.storage.local.set({
            lastLegitimateUrl: details.url
          });

          console.log(
            "Legitimate primary navigation:",
            details.url
          );

        } else {

          // ----------------------------------------
          // RESTORATION COMPLETED
          // ----------------------------------------

          chrome.storage.local.set({
            restoringPrimary: false
          });

          console.log(
            "Primary page restored."
          );

        }

      }
    );

  }
);


// ==========================================
// TRACK NEW TABS CREATED BY PRIMARY TAB
// ==========================================

chrome.tabs.onCreated.addListener(
  (tab) => {

    chrome.storage.local.get(
      [
        "primaryTabId",
        "protectionEnabled",
        "redirectTabs"
      ],
      (data) => {

        if (!data.protectionEnabled) {
          return;
        }

        if (
          data.primaryTabId === undefined ||
          data.primaryTabId === null
        ) {
          return;
        }


        // Only tabs opened by Primary are tracked.

        if (
          tab.openerTabId !== data.primaryTabId
        ) {
          return;
        }


        const redirectTabs =
          data.redirectTabs || [];


        const alreadyTracked =
          redirectTabs.some(
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

        }

      }
    );

  }
);


// ==========================================
// UPDATE REDIRECT TAB URL
// ==========================================

chrome.webNavigation.onCommitted.addListener(
  (details) => {

    if (details.frameId !== 0) {
      return;
    }

    chrome.storage.local.get(
      "redirectTabs",
      (data) => {

        const redirectTabs =
          data.redirectTabs || [];


        const tabIndex =
          redirectTabs.findIndex(
            item => item.tabId === details.tabId
          );


        if (tabIndex === -1) {
          return;
        }


        redirectTabs[tabIndex].url =
          details.url;


        chrome.storage.local.set({
          redirectTabs: redirectTabs
        });


        // Tell the page that it is an EVIL redirect tab.

        chrome.tabs.sendMessage(
          details.tabId,
          {
            type: "redirectStatus",
            status:
              redirectTabs[tabIndex].status
          },
          () => {

            // Ignore if content script is not ready.

            chrome.runtime.lastError;

          }
        );

      }
    );

  }
);


// ==========================================
// CONTENT SCRIPT READY
// ==========================================

chrome.runtime.onMessage.addListener(
  (message, sender) => {

    if (
      message.type !== "contentReady"
    ) {
      return;
    }

    if (!sender.tab || sender.tab.id === undefined) {
      return;
    }

    const tabId = sender.tab.id;


    chrome.storage.local.get(
      "redirectTabs",
      (data) => {

        const redirectTabs =
          data.redirectTabs || [];


        const redirectTab =
          redirectTabs.find(
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

      }
    );

  }
);


// ==========================================
// TOGGLE EVIL / NOT EVIL
// ==========================================

chrome.runtime.onMessage.addListener(
  (message, sender) => {

    if (
      message.type !== "toggleRedirectStatus"
    ) {
      return;
    }


    if (
      !sender.tab ||
      sender.tab.id === undefined
    ) {
      return;
    }


    const tabId = sender.tab.id;


    chrome.storage.local.get(
      "redirectTabs",
      (data) => {

        const redirectTabs =
          data.redirectTabs || [];


        const tabIndex =
          redirectTabs.findIndex(
            item => item.tabId === tabId
          );


        if (tabIndex === -1) {
          return;
        }


        if (
          redirectTabs[tabIndex].status === "EVIL"
        ) {

          redirectTabs[tabIndex].status =
            "NOT_EVIL";

        } else {

          redirectTabs[tabIndex].status =
            "EVIL";

        }


        chrome.storage.local.set({
          redirectTabs: redirectTabs
        });


        chrome.tabs.sendMessage(
          tabId,
          {
            type: "redirectStatus",
            status:
              redirectTabs[tabIndex].status
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

      }
    );

  }
);


// ==========================================
// REMOVE CLOSED REDIRECT TABS
// ==========================================

chrome.tabs.onRemoved.addListener(
  (tabId) => {

    chrome.storage.local.get(
      "redirectTabs",
      (data) => {

        const redirectTabs =
          data.redirectTabs || [];


        const updatedTabs =
          redirectTabs.filter(
            item => item.tabId !== tabId
          );


        chrome.storage.local.set({
          redirectTabs: updatedTabs
        });

      }
    );

  }
);


// ==========================================
// CLEAR ONLY EVIL REDIRECT TABS
// ==========================================

function clearEvilRedirectTabs() {

  chrome.storage.local.get(
    "redirectTabs",
    (data) => {

      const redirectTabs =
        data.redirectTabs || [];


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


      console.log(
        "EVIL redirect tabs cleared."
      );

    }
  );

}