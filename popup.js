document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // LOAD INITIAL STATE
  // ==========================================

  chrome.storage.local.get(["primaryTabId", "protectionEnabled"], (data) => {
    updateStatus(data.primaryTabId, data.protectionEnabled);
    updatePrimaryButtonColor();

    const protectionBtn = document.getElementById("toggleProtection");

    protectionBtn.style.backgroundColor =
      data.protectionEnabled ? "#1976d2" : "#238636";

    updateRedirectCount();
  });

  // ==========================================
  // SET PRIMARY TAB
  // ==========================================

  document.getElementById("setPrimary").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;

      chrome.storage.local.set({ primaryTabId: tabs[0].id }, () => {
        chrome.storage.local.get("protectionEnabled", (data) => {
          updateStatus(tabs[0].id, data.protectionEnabled);
          updatePrimaryButtonColor();
        });
      });
    });
  });

  // ==========================================
  // TOGGLE PROTECTION
  // ==========================================

  document.getElementById("toggleProtection").addEventListener("click", () => {
    chrome.storage.local.get("protectionEnabled", (data) => {
      const newState = !data.protectionEnabled;

      chrome.storage.local.set({ protectionEnabled: newState }, () => {
        chrome.storage.local.get("primaryTabId", (d) => {
          updateStatus(d.primaryTabId, newState);
          updatePrimaryButtonColor();

          const protectionBtn = document.getElementById("toggleProtection");

          protectionBtn.style.backgroundColor =
            newState ? "#1976d2" : "#238636";
        });
      });
    });
  });

  // ==========================================
  // CLEAR OTHER TABS
  // ==========================================

  document.getElementById("clearOthers").addEventListener("click", () => {
    chrome.storage.local.get("primaryTabId", (data) => {
      if (!data.primaryTabId) {
        alert("No primary tab set.");
        return;
      }

      chrome.tabs.query({}, (tabs) => {
        for (const t of tabs) {
          if (t.id !== data.primaryTabId) {
            chrome.tabs.remove(t.id);
          }
        }
      });
    });
  });
});

// ==========================================
// UPDATE STATUS
// ==========================================

function updateStatus(primaryTabId, protectionEnabled) {
  const btn = document.getElementById("toggleProtection");
  const status = document.getElementById("status");

  btn.textContent = protectionEnabled
    ? "Disable Protection"
    : "Enable Protection";

  status.textContent = primaryTabId
    ? `Primary tab: ${primaryTabId} | Protection: ${
        protectionEnabled ? "ON" : "OFF"
      }`
    : "No primary tab set";
}

// ==========================================
// REDIRECT COUNTER
// ==========================================

function updateRedirectCount() {
  chrome.storage.local.get("redirectCount", (data) => {
    const count = data.redirectCount || 0;
    const counter = document.getElementById("redirectCount");

    if (counter) {
      counter.textContent = count;
    }
  });
}

// ==========================================
// LIVE REDIRECT COUNTER UPDATE
// ==========================================

chrome.storage.onChanged.addListener((changes) => {
  if (changes.redirectCount) {
    const counter = document.getElementById("redirectCount");

    if (counter) {
      counter.textContent = changes.redirectCount.newValue || 0;
    }
  }
});

// ==========================================
// PRIMARY BUTTON COLOR
// ==========================================

function updatePrimaryButtonColor() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    const currentTabId = tabs[0].id;

    chrome.storage.local.get("primaryTabId", (data) => {
      const primaryBtn = document.getElementById("setPrimary");

      if (!primaryBtn) return;

      if (currentTabId === data.primaryTabId) {
        // Current tab IS the primary tab
        primaryBtn.style.backgroundColor = "#1976d2";
      } else {
        // Current tab is NOT the primary tab
        primaryBtn.style.backgroundColor = "#4CAF50";
      }
    });
  });
}