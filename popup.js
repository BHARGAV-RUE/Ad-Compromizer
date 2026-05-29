document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["primaryTabId", "protectionEnabled"], (data) => {
    updateStatus(data.primaryTabId, data.protectionEnabled);
  });
});

document.getElementById("setPrimary").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.storage.local.set({ primaryTabId: tabs[0].id }, () => {
      chrome.storage.local.get("protectionEnabled", (data) => {
        updateStatus(tabs[0].id, data.protectionEnabled);
      });
    });
  });
});

document.getElementById("toggleProtection").addEventListener("click", () => {
  chrome.storage.local.get("protectionEnabled", (data) => {
    const newState = !data.protectionEnabled;
    chrome.storage.local.set({ protectionEnabled: newState }, () => {
      chrome.storage.local.get("primaryTabId", (d) => {
        updateStatus(d.primaryTabId, newState);
      });
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
    ? `Primary tab: ${primaryTabId} | Protection: ${protectionEnabled ? "ON ✅" : "OFF ❌"}`
    : "No primary tab set";
}

/* ---------- BUTTON COLORS & UI ---------- */

function updateButtonStyles(primaryTabId, protectionEnabled) {

  const primaryBtn =
    document.getElementById("setPrimary");

  const toggleBtn =
    document.getElementById("toggleProtection");

  /* PRIMARY BUTTON */

  if (primaryTabId) {

    primaryBtn.style.backgroundColor =
      "#4CAF50";

  } else {

    primaryBtn.style.backgroundColor =
      "#d32f2f";

  }

  /* TOGGLE BUTTON */

  if (protectionEnabled) {

    toggleBtn.style.backgroundColor =
      "#4CAF50";

  } else {

    toggleBtn.style.backgroundColor =
      "#1976d2";

  }

}

/* ---------- OVERRIDE UPDATE STATUS ---------- */

const oldUpdateStatus = updateStatus;

updateStatus = function (
  primaryTabId,
  protectionEnabled
) {

  oldUpdateStatus(
    primaryTabId,
    protectionEnabled
  );

  updateButtonStyles(
    primaryTabId,
    protectionEnabled
  );

};

/* ---------- CLEAR BUTTON EFFECT ---------- */

document.getElementById("clearOthers")
.addEventListener("click", () => {

  const clearBtn =
    document.getElementById("clearOthers");

  clearBtn.style.backgroundColor =
    "#4CAF50";

  clearBtn.textContent =
    "Cleared Redirected Tabs";

  setTimeout(() => {

    clearBtn.style.backgroundColor =
      "#616161";

    clearBtn.textContent =
      "Clear All Except Primary";

  }, 2000);

});