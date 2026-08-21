// Runs in the context of every webpage

const originalOpen = window.open;

window.open = function (...args) {

  // Notify background that a new window/tab was opened
  chrome.runtime.sendMessage({
    type: "newWindowOpened"
  });

  // Let the website open the window normally
  return originalOpen.apply(this, args);

};