document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    ["primaryTabId", "protectionEnabled"],
    (data) => {

      updateStatus(
        data.primaryTabId,
        data.protectionEnabled
      );

      updatePrimaryButtonColor();
    }
  );
});
document.getElementById("setPrimary").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.storage.local.set({ primaryTabId: tabs[0].id }, () => {
      chrome.storage.local.get("protectionEnabled", (data) => {

        updateStatus(
          tabs[0].id,
          data.protectionEnabled
        );

        updatePrimaryButtonColor();
      });
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("toggleProtection").addEventListener("click", () => {

    chrome.storage.local.get("protectionEnabled", (data) => {

      const newState = !data.protectionEnabled;

      chrome.storage.local.set(
        { protectionEnabled: newState },
        () => {

          chrome.storage.local.get("primaryTabId", (d) => {

            updateStatus(
              d.primaryTabId,
              newState
            );
          });
        }
      );
    });
  });
});
document.getElementById("clearOthers").addEventListener("click", () => {
  chrome.storage.local.get("primaryTabId", (data) => {
    if (!data.primaryTabId) {
      alert("No primary tab set.");
      return;
    }
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (t.id !== data.primaryTabId) chrome.tabs.remove(t.id);
      }
    });
  });
});

function updateStatus(primaryTabId, protectionEnabled) {
  const btn = document.getElementById("toggleProtection");
  const status = document.getElementById("status");

  btn.textContent = protectionEnabled ? "Disable Protection" : "Enable Protection";
  status.textContent = primaryTabId
    ? `Primary tab: ${primaryTabId} | Protection: ${protectionEnabled ? "ON" : "OFF"}`
    : "No primary tab set";
}



/* ---------- BUTTON COLORS ---------- */

function updatePrimaryButtonColor() {
  chrome.tabs.query(
    { active: true, currentWindow: true },
    (tabs) => {

      if (!tabs[0]) return;

      const currentTabId = tabs[0].id;

      chrome.storage.local.get("primaryTabId", (data) => {

        const primaryBtn =
          document.getElementById("setPrimary");

        if (currentTabId === data.primaryTabId) {
          // Current tab IS the primary tab
          primaryBtn.style.backgroundColor = "#1976d2"; // Blue
        } else {
          // Current tab is NOT the primary tab
          primaryBtn.style.backgroundColor = "#4CAF50"; // Green
        }

      });
    }
  );
}