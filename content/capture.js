(() => {
  const url = location.href;
  chrome.runtime.sendMessage({ type: "CAPTURE_LINK", url, openedAt: new Date().toISOString() });
})();

