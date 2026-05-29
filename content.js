// Runs in the context of every webpage
const originalOpen = window.open;
window.open = function(...args) {
  // Let it open, but notify background to suppress focus
  chrome.runtime.sendMessage({ type: "newWindowOpened" });
  return originalOpen.apply(this, args);
};