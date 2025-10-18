let settings = {
  targetEmail: "",
  keyword: ""
};

let isChecking = false;

// Load saved settings and state when service worker wakes
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ targetEmail: "", keyword: "", isChecking: false });
});

chrome.storage.sync.get(["targetEmail", "keyword", "isChecking"], (data) => {
  settings.targetEmail = data.targetEmail || "";
  settings.keyword = data.keyword || "";
  isChecking = data.isChecking === true;
  updateIcon();
  // If was checking before, restart the alarm (alarms don't persist across service worker restarts)
  if (isChecking) {
    chrome.alarms.create("checkEmail", { periodInMinutes: 0.5 }); // 30 sec
    console.log("[BG] Restored periodic check.");
  }
});

// Utility to update the extension icon
function updateIcon() {
    const path = isChecking ? "icon_active.png" : "icon.png"; // Assuming you have an active and inactive icon
    chrome.action.setIcon({ path: path });
}

// Function to notify the popup of the current state
function notifyPopupStatus() {
    chrome.runtime.sendMessage({ type: "statusUpdate", isChecking, settings });
}

// Listen for popup updates and commands
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "updateSettings") {
    settings.targetEmail = msg.targetEmail.trim();
    settings.keyword = msg.keyword.trim();
    chrome.storage.sync.set(settings, () => {
      console.log("[BG] Settings updated:", settings);
      notifyPopupStatus(); // Update popup after saving
    });
  }

  if (msg.type === "startChecking") {
    console.log("[BG] Starting periodic check...");
    chrome.alarms.create("checkEmail", { periodInMinutes: 0.5 }); // 30 sec
    isChecking = true;
    chrome.storage.sync.set({ isChecking });
    updateIcon();
    notifyPopupStatus();
    sendResponse({ started: true });
    return true; // Keep the message channel open for sendResponse
  }

  if (msg.type === "stopChecking") {
    console.log("[BG] Stopping periodic check...");
    chrome.alarms.clear("checkEmail");
    isChecking = false;
    chrome.storage.sync.set({ isChecking });
    updateIcon();
    notifyPopupStatus();
    sendResponse({ stopped: true });
    return true; // Keep the message channel open for sendResponse
  }
  
  if (msg.type === "requestStatus") {
      notifyPopupStatus();
      sendResponse({ status: isChecking, settings: settings });
      return true;
  }
});

// Alarm for periodic email check
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkEmail") {
    console.log("[BG] Triggering content script to check email");
    // Only inject if the user has specified a target email (optimization)
    if (!settings.targetEmail) {
        console.log("[BG] No target email set. Skipping check.");
        return;
    }
    
    // Check all open Gmail tabs
    chrome.tabs.query({ url: "*://mail.google.com/*" }, (tabs) => {
      tabs.forEach(tab => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        }).catch(err => console.error(`[BG] Script injection failed for tab ${tab.id}:`, err));
      });
    });
  }
});

// Receive from content.js when email found
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "alarm_trigger") {
    console.log(`[BG] Email matched criteria from: ${msg.from}. Playing alarm...`);
    playAlarm();
    // Show a minimal notification in the extension UI
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
    
    // Show a native notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "New Message Alert! 🔔",
      message: `You got a message from: ${msg.from}`
    });
    
    // Clear the badge after a short time
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000); 
  }
});

/**
 * Plays the static 'alarm.mp3' sound.
 */
function playAlarm() {
  const audio = new Audio(chrome.runtime.getURL("alarm.mp3"));
  audio.play().catch(err => console.error("[BG] Alarm error (user must interact with a page before audio works in some contexts):", err));
}