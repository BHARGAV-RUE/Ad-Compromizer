document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // LOAD INITIAL STATE
  // ==========================================

  chrome.storage.local.get(
    [
      "primaryTabId",
      "protectionEnabled"
    ],
    (data) => {

      updateStatus(
        data.primaryTabId,
        data.protectionEnabled
      );

      updatePrimaryButtonColor();

      updateProtectionButton(
        data.protectionEnabled
      );

      updateRedirectCount();

    }
  );


  // ==========================================
  // SET / REMOVE PRIMARY
  // ==========================================

  document
    .getElementById("setPrimary")
    .addEventListener("click", () => {

      chrome.tabs.query(
        {
          active: true,
          currentWindow: true
        },
        (tabs) => {

          if (!tabs[0]) {
            return;
          }


          const tabId =
            tabs[0].id;


          chrome.storage.local.get(
            "primaryTabId",
            (data) => {

              if (
                data.primaryTabId === tabId
              ) {

                // --------------------------------
                // REMOVE PRIMARY
                // --------------------------------

                chrome.storage.local.set({
                  primaryTabId: null,
                  lastLegitimateUrl: null,
                  redirectCount: 0,
                  redirectTabs: [],
                  protectionEnabled: false
                }, () => {

                  updateStatus(
                    null,
                    false
                  );

                  updatePrimaryButtonColor();

                  updateProtectionButton(
                    false
                  );

                  updateRedirectCount();

                });

              } else {

                // --------------------------------
                // SET PRIMARY
                // --------------------------------

                chrome.tabs.get(
                  tabId,
                  (tab) => {

                    chrome.storage.local.set({
                      primaryTabId: tabId,
                      lastLegitimateUrl:
                        tab.url || "",
                      redirectCount: 0,
                      redirectTabs: []
                    }, () => {

                      chrome.storage.local.get(
                        "protectionEnabled",
                        (d) => {

                          updateStatus(
                            tabId,
                            d.protectionEnabled
                          );

                          updatePrimaryButtonColor();

                          updateProtectionButton(
                            d.protectionEnabled
                          );

                          updateRedirectCount();

                        }
                      );

                    });

                  }
                );

              }

            }
          );

        }
      );

    });


  // ==========================================
  // TOGGLE PROTECTION
  // ==========================================

  document
    .getElementById("toggleProtection")
    .addEventListener("click", () => {

      chrome.storage.local.get(
        [
          "primaryTabId",
          "protectionEnabled"
        ],
        (data) => {

          if (
            data.primaryTabId === undefined ||
            data.primaryTabId === null
          ) {

            alert(
              "Set a Primary Tab first."
            );

            return;
          }


          const newState =
            !data.protectionEnabled;


          chrome.storage.local.set({
            protectionEnabled: newState
          }, () => {

            updateStatus(
              data.primaryTabId,
              newState
            );

            updateProtectionButton(
              newState
            );

          });

        }
      );

    });


  // ==========================================
  // CLEAR EVIL REDIRECT TABS
  // ==========================================

  document
    .getElementById("clearOthers")
    .addEventListener("click", () => {

      chrome.storage.local.get(
        "redirectTabs",
        (data) => {

          const redirectTabs =
            data.redirectTabs || [];


          const evilTabs =
            redirectTabs.filter(
              item => item.status === "EVIL"
            );


          if (evilTabs.length === 0) {

            alert(
              "No EVIL redirect tabs to clear."
            );

            return;

          }


          for (const item of evilTabs) {

            chrome.tabs.remove(
              item.tabId,
              () => {

                chrome.runtime.lastError;

              }
            );

          }


          const remaining =
            redirectTabs.filter(
              item => item.status !== "EVIL"
            );


          chrome.storage.local.set({
            redirectTabs: remaining
          });

        }
      );

    });

});


// ==========================================
// UPDATE STATUS
// ==========================================

function updateStatus(
  primaryTabId,
  protectionEnabled
) {

  const btn =
    document.getElementById(
      "toggleProtection"
    );


  const status =
    document.getElementById("status");


  btn.textContent =
    protectionEnabled
      ? "Disable Protection"
      : "Enable Protection";


  status.textContent =
    primaryTabId
      ? `Primary tab: ${primaryTabId} | Protection: ${
          protectionEnabled
            ? "ON"
            : "OFF"
        }`
      : "No primary tab set";

}


// ==========================================
// PROTECTION BUTTON
// ==========================================

function updateProtectionButton(
  protectionEnabled
) {

  const btn =
    document.getElementById(
      "toggleProtection"
    );


  if (!btn) {
    return;
  }


  btn.style.backgroundColor =
    protectionEnabled
      ? "#1976d2"
      : "#238636";

}


// ==========================================
// REDIRECT COUNTER
// ==========================================

function updateRedirectCount() {

  chrome.storage.local.get(
    "redirectCount",
    (data) => {

      const counter =
        document.getElementById(
          "redirectCount"
        );


      if (!counter) {
        return;
      }


      counter.textContent =
        data.redirectCount || 0;

    }
  );

}


// ==========================================
// LIVE COUNTER
// ==========================================

chrome.storage.onChanged.addListener(
  (changes) => {

    if (
      changes.redirectCount
    ) {

      const counter =
        document.getElementById(
          "redirectCount"
        );


      if (counter) {

        counter.textContent =
          changes.redirectCount.newValue || 0;

      }

    }

  }
);


// ==========================================
// PRIMARY BUTTON COLOR
// ==========================================

function updatePrimaryButtonColor() {

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true
    },
    (tabs) => {

      if (!tabs[0]) {
        return;
      }


      const currentTabId =
        tabs[0].id;


      chrome.storage.local.get(
        "primaryTabId",
        (data) => {

          const primaryBtn =
            document.getElementById(
              "setPrimary"
            );


          if (!primaryBtn) {
            return;
          }


          if (
            currentTabId ===
            data.primaryTabId
          ) {

            primaryBtn.style.backgroundColor =
              "#1976d2";

            primaryBtn.textContent =
              "Remove Primary";

          } else {

            primaryBtn.style.backgroundColor =
              "#4CAF50";

            primaryBtn.textContent =
              "Set as Primary";

          }

        }
      );

    }
  );

}