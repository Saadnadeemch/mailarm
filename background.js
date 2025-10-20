// background.js (updated)
// Uses chrome.alarms to reliably schedule periodic checks in MV3 service worker.

// --- GLOBAL STATE ---
let monitoringActive = false;
let rules = [];
let lastAlarm = null;
let alarmRinging = false;

// development check interval (ms). 10000 = 10s.
const CHECK_INTERVAL_MS = 10_000;
const ALARM_NAME = 'gmailCheck';

// --- INITIALIZATION ---
// restore persisted state if available
chrome.storage.local.get(['rules', 'monitoringActive', 'lastAlarm', 'alarmRinging'], (data) => {
  if (Array.isArray(data.rules)) rules = data.rules;
  if (typeof data.monitoringActive === 'boolean') monitoringActive = data.monitoringActive;
  if (data.lastAlarm) lastAlarm = data.lastAlarm;
  if (typeof data.alarmRinging === 'boolean') alarmRinging = data.alarmRinging;

  // If monitoring was active when extension reloaded, resume the alarm schedule
  if (monitoringActive) {
    triggerGmailCheck(); // immediate
    scheduleNextCheck();
  }

  // send initial status to any open popup(s)
  sendStatus();
});

// --- HELPERS: persist state ---
function persistState() {
  chrome.storage.local.set({
    rules,
    monitoringActive,
    lastAlarm,
    alarmRinging
  }, () => {
    // no-op
  });
}

// --- MESSAGE HANDLER ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[Background] Received message:', msg);

  if (!msg || !msg.type) {
    sendResponse && sendResponse({ error: 'invalid_message' });
    return false;
  }

  // === Rule Management ===
  if (msg.type === 'updateRules') {
    rules = Array.isArray(msg.rules) ? msg.rules : [];
    console.log('[Background] Rules updated:', rules);
    persistState();
    sendStatus();
    sendResponse && sendResponse({ success: true });
    return true;
  }

  // === Start Monitoring === (from popup)
  if (msg.type === 'startChecking') {
    if (!Array.isArray(rules) || rules.length === 0) {
      console.warn('[Background] startChecking blocked: no rules defined');
      sendResponse && sendResponse({ error: 'no_rules' });
      return true;
    }
    monitoringActive = true;
    persistState();
    // kick off immediate check and scheduled checks
    triggerGmailCheck();
    scheduleNextCheck();
    sendStatus();
    sendResponse && sendResponse({ success: true });
    return true;
  }

  // === Stop Monitoring === (from popup)
  if (msg.type === 'stopChecking') {
    monitoringActive = false;
    persistState();
    clearScheduledCheck();
    sendStatus();
    sendResponse && sendResponse({ success: true });
    return true;
  }

  // === Request Status === (popup asks current state)
  if (msg.type === 'requestStatus') {
    sendResponse && sendResponse({
      status: monitoringActive,
      rules,
      lastAlarm,
      alarmRinging
    });
    return true;
  }

  // === Stop Alarm (popup) ===
  if (msg.type === 'stopAlarm') {
    stopAlarmSound();
    sendResponse && sendResponse({ success: true });
    return true;
  }

  // === Alarm triggered by content.js (match found) ===
  if (msg.type === 'alarm_trigger') {
    // message from content.js telling us match found
    const details = {
      from: msg.from || 'Unknown',
      subject: msg.subject || '',
      time: new Date().toLocaleString()
    };
    console.log('[Background] alarm_trigger received:', details);
    triggerAlarm(details);
    sendResponse && sendResponse({ success: true });
    return true;
  }

  // unknown message
  sendResponse && sendResponse({ error: 'unknown_type' });
  return false;
});

// --- ALARM SCHEDULING (use chrome.alarms so MV3 wakes service worker) ---
function scheduleNextCheck() {
  // Use alarms with when to allow sub-minute intervals reliably:
  const when = Date.now() + CHECK_INTERVAL_MS;
  chrome.alarms.create(ALARM_NAME, { when });
  console.log(`[Background] Scheduled next check in ${CHECK_INTERVAL_MS} ms.`);
}

function clearScheduledCheck() {
  chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
    if (wasCleared) {
      console.log('[Background] Cleared scheduled check alarm.');
    }
  });
}

// Alarm fired -> perform a check and re-schedule if monitoringActive
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || alarm.name !== ALARM_NAME) return;
  console.log('[Background] Alarm fired:', alarm);
  if (monitoringActive) {
    triggerGmailCheck();
    // schedule next only when monitoring is still active
    scheduleNextCheck();
  } else {
    clearScheduledCheck();
  }
});

// --- Trigger Gmail check by sending a message to content scripts ---
// Content script is responsible for inspecting Gmail DOM and responding with alarm_trigger when a match is found
function triggerGmailCheck() {
  chrome.tabs.query({ url: '*://mail.google.com/*' }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.log('[Background] No Gmail tabs found.');
      return;
    }
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'refresh_and_check', rules }, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) {
          // content script might not be injected in that tab (e.g., Gmail not fully loaded)
          console.warn(`[Background] Could not message tab ${tab.id}:`, err.message);
        } else {
          // resp may be used by content script to confirm check
          // console.log(`[Background] Tab ${tab.id} responded:`, resp);
        }
      });
    });
  });
}

// --- ALARM HANDLING ---
// Called when content tells background a match found (or when background decides)
function triggerAlarm(details) {
  lastAlarm = details;
  alarmRinging = true;
  persistState();

  // 1) notify popup UI(s)
  sendStatus();

  // 2) forward play_sound to all Gmail tabs so audio plays in tab context
  chrome.tabs.query({ url: '*://mail.google.com/*' }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.warn('[Background] No Gmail tab to play sound.');
    } else {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: 'play_sound', from: details.from }, (resp) => {
          if (chrome.runtime.lastError) {
            console.warn(`[Background] play_sound message failed for tab ${tab.id}:`, chrome.runtime.lastError.message);
          }
        });
      });
    }
  });

  // 3) Set extension badge to show alert
  try {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#d32f2f' });
    // Clear badge after 6s (best-effort)
    setTimeout(() => {
      try { chrome.action.setBadgeText({ text: '' }); } catch (e) { /* ignore */ }
    }, 6000);
  } catch (e) {
    console.warn('[Background] Could not set badge:', e);
  }

  // 4) Send a desktop notification (if permission exists)
  try {
    const id = `alarm_${Date.now()}`;
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Email Match Found!',
      message: `Matched email from ${details.from}`,
      silent: true
    }, () => {
      if (chrome.runtime.lastError) {
        // notifications permission might be missing
        console.warn('[Background] notification.create error:', chrome.runtime.lastError.message);
      }
    });
  } catch (e) {
    console.warn('[Background] notification failed:', e);
  }
}

// Stop alarm: clear flag and instruct content scripts to stop sound
function stopAlarmSound() {
  alarmRinging = false;
  persistState();

  // Tell Gmail tabs to stop playing audio (content script should implement stop)
  chrome.tabs.query({ url: '*://mail.google.com/*' }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'stop_sound' }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn(`[Background] stop_sound message failed for tab ${tab.id}:`, chrome.runtime.lastError.message);
        }
      });
    });
  });

  sendStatus();
}

// --- STATUS SYNC ---
// inform any open popup(s) about current state
function sendStatus() {
  chrome.runtime.sendMessage({
    type: 'statusUpdate',
    isChecking: monitoringActive,
    rules,
    lastAlarm,
    alarmRinging
  }, () => {
    if (chrome.runtime.lastError) {
      // no open popup, that's fine
    }
  });
}