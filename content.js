// ==========================================
// CREATE FLOATING EVIL BUTTON
// ==========================================

let evilButton = null;


// ==========================================
// CONTENT SCRIPT READY
// ==========================================

chrome.runtime.sendMessage({
  type: "contentReady"
});


// ==========================================
// RECEIVE REDIRECT STATUS
// ==========================================

chrome.runtime.onMessage.addListener(
  (message) => {

    if (
      message.type !== "redirectStatus"
    ) {
      return;
    }


    if (message.status === "EVIL") {

      showEvilButton();

    }


    if (message.status === "NOT_EVIL") {

      showNotEvilButton();

    }

  }
);


// ==========================================
// CREATE BUTTON
// ==========================================

function createButton() {

  if (evilButton) {
    return;
  }


  evilButton =
    document.createElement("button");


  evilButton.id =
    "ad-compromizer-evil-button";


  evilButton.type =
    "button";


  evilButton.textContent =
    "😈";


  evilButton.title =
    "Marked EVIL. Click to mark as NOT EVIL.";


  evilButton.addEventListener(
    "click",
    () => {

      chrome.runtime.sendMessage({
        type: "toggleRedirectStatus"
      });

    }
  );


  document.documentElement.appendChild(
    evilButton
  );


  applyEvilStyle();

}


// ==========================================
// EVIL STATE
// ==========================================

function showEvilButton() {

  createButton();


  evilButton.textContent =
    "😈";


  evilButton.title =
    "Marked EVIL. Click to mark as NOT EVIL.";


  applyEvilStyle();

}


// ==========================================
// NOT EVIL STATE
// ==========================================

function showNotEvilButton() {

  createButton();


  evilButton.textContent =
    "😺";


  evilButton.title =
    "Marked NOT EVIL. Click to mark as EVIL.";


  applyNotEvilStyle();

}


// ==========================================
// EVIL STYLE
// ==========================================

function applyEvilStyle() {

  if (!evilButton) {
    return;
  }


  evilButton.style.cssText = `
    position: fixed !important;
    right: 20px !important;
    bottom: 20px !important;
    width: 58px !important;
    height: 58px !important;
    border-radius: 50% !important;
    border: 3px solid #ff3333 !important;
    background: #151515 !important;
    color: white !important;
    font-size: 30px !important;
    cursor: pointer !important;
    z-index: 2147483647 !important;
    box-shadow: 0 0 20px rgba(255, 0, 0, 0.65) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    margin: 0 !important;
    opacity: 1 !important;
  `;

}


// ==========================================
// NOT EVIL STYLE
// ==========================================

function applyNotEvilStyle() {

  if (!evilButton) {
    return;
  }


  evilButton.style.cssText = `
    position: fixed !important;
    right: 20px !important;
    bottom: 20px !important;
    width: 58px !important;
    height: 58px !important;
    border-radius: 50% !important;
    border: 3px solid #4caf50 !important;
    background: #151515 !important;
    color: white !important;
    font-size: 30px !important;
    cursor: pointer !important;
    z-index: 2147483647 !important;
    box-shadow: 0 0 20px rgba(76, 175, 80, 0.55) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    margin: 0 !important;
    opacity: 1 !important;
  `;

}