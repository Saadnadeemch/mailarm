// content.js (updated)

(function () {
  const IFRAME_ID = 'extension-alarm-iframe';
  const AUDIO_ID = 'extension-alarm-audio';
  const ALERT_ID = 'extension-alarm-alert';
  const DEV_LOG_PREFIX = '[Content]';

  if (window.extensionAlarmContentScriptInitialized) {
    window.checkGmail = window.checkGmail || (() => {});
    console.log(`${DEV_LOG_PREFIX} Already initialized in this tab.`);
    return;
  }
  window.extensionAlarmContentScriptInitialized = true;

  const TRIGGER_COOLDOWN_MS = 30_000;
  const lastTriggerTimes = {}; 

  // --------------------
  // Audio helpers
  // --------------------
  function injectAudioIframe() {
    if (document.getElementById(IFRAME_ID)) return;
    try {
      const iframe = document.createElement('iframe');
      iframe.id = IFRAME_ID;
      iframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
      iframe.srcdoc = `
        <!doctype html>
        <html>
          <body>
            <audio id="alarm-audio" src="${chrome.runtime.getURL('alarm.mp3')}" preload="auto"></audio>
            <script>
              const audio = document.getElementById('alarm-audio');
              window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'PLAY_ALARM') {
                  audio.currentTime = 0;
                  audio.play().catch(err => console.warn('Iframe: play blocked', err));
                } else if (event.data && event.data.type === 'STOP_ALARM') {
                  audio.pause();
                  audio.currentTime = 0;
                } else if (event.data && event.data.type === 'TEST_ALARM') {
                  audio.currentTime = 0;
                  audio.play().then(() => setTimeout(()=>{ audio.pause(); audio.currentTime = 0; }, 2000)).catch(()=>{});
                }
              });
              window.parent.postMessage({ type: 'IFRAME_READY' }, '*');
            <\/script>
          </body>
        </html>`;
      document.documentElement.appendChild(iframe);
      console.log(`${DEV_LOG_PREFIX} Audio iframe injected.`);
    } catch (e) {
      console.warn(`${DEV_LOG_PREFIX} injectAudioIframe error:`, e);
    }
  }

  function injectFallbackAudio() {
    if (document.getElementById(AUDIO_ID)) return;
    try {
      const audio = document.createElement('audio');
      audio.id = AUDIO_ID;
      audio.src = chrome.runtime.getURL('alarm.mp3');
      audio.preload = 'auto';
      audio.style.display = 'none';
      document.documentElement.appendChild(audio);
      console.log(`${DEV_LOG_PREFIX} Fallback audio element ready.`);
    } catch (e) {
      console.warn(`${DEV_LOG_PREFIX} injectFallbackAudio error:`, e);
    }
  }

  function playAlarmSound() {
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ type: 'PLAY_ALARM' }, '*');
      } catch (e) {
        console.warn(`${DEV_LOG_PREFIX} iframe postMessage failed:`, e);
      }
    }

    const audio = document.getElementById(AUDIO_ID);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch((e) => console.warn(`${DEV_LOG_PREFIX} fallback audio play blocked:`, e));
    }
  }

  function stopAlarmSound() {
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ type: 'STOP_ALARM' }, '*');
      } catch (e) {}
    }
    const audio = document.getElementById(AUDIO_ID);
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {}
    }
    const a = document.getElementById(ALERT_ID);
    if (a) a.style.display = 'none';
  }

  function testAlarmShort() {
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ type: 'TEST_ALARM' }, '*');
      } catch (e) {}
    }
    const audio = document.getElementById(AUDIO_ID);
    if (audio) {
      audio.currentTime = 0;
      audio.play().then(() => {
        setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
        }, 2000);
      }).catch(() => {});
    }
  }

  // --------------------
  // Visual alert
  // --------------------
  function showVisualAlert(sender) {
    let alertDiv = document.getElementById(ALERT_ID);
    if (!alertDiv) {
      alertDiv = document.createElement('div');
      alertDiv.id = ALERT_ID;
      alertDiv.style.cssText =
        'position:fixed;top:10px;right:10px;padding:10px;background-color:#14A300;color:white;z-index:2147483647;border-radius:6px;font-weight:bold;box-shadow:0 4px 8px rgba(0,0,0,0.2);';
      document.documentElement.appendChild(alertDiv);
    }
    alertDiv.textContent = `🔔 Match found from ${sender}`;
    alertDiv.style.display = 'block';
  }

  // --------------------
  // Gmail scanning
  // --------------------
  // Accepts optional rules param (array). If not provided, falls back to chrome.storage.local
  function checkGmail(providedRules) {
    try {
      console.log(`${DEV_LOG_PREFIX} Running Email Check...`);
      const handleRules = (rules) => {
        const rulesArr = Array.isArray(rules) ? rules : [];
        if (rulesArr.length === 0) return;

        // Select unread rows (Gmail uses zA rows; zE marks unread). Be tolerant to variations.
        const emailRows = Array.from(document.querySelectorAll('.zA')).filter(r => r.classList.contains('zE'));
        if (!emailRows || emailRows.length === 0) {
          console.log(`${DEV_LOG_PREFIX} No unread rows found.`);
          return;
        }

        emailRows.forEach((row) => {
          // avoid re-processing rows we've already handled
          if (row.dataset.extensionProcessed === '1') return;

          // Try several sender selectors used in Gmail UI
          let sender = '';
          const senderAttr = row.querySelector('span[email]');
          if (senderAttr) {
            sender = senderAttr.getAttribute('email') || senderAttr.textContent || '';
          } else {
            // fallback: look for elements that often contain sender name/address
            const s = row.querySelector('.yP, .yW span, .yX.xY span');
            if (s) sender = s.getAttribute('email') || s.textContent || '';
          }
          sender = (sender || '').trim();
          const subject = (row.querySelector('.y6 span')?.textContent || '').trim();
          if (!sender) return;

          const senderLower = sender.toLowerCase();
          const subjectLower = subject.toLowerCase();

          const match = rulesArr.find((rule) => {
            const ruleEmail = (rule.email || '').trim().toLowerCase();
            const ruleKeyword = (rule.keyword || '').trim().toLowerCase();
            const emailMatch = ruleEmail ? senderLower.includes(ruleEmail) : false;
            const keywordMatch = !ruleKeyword || subjectLower.includes(ruleKeyword);
            return emailMatch && keywordMatch;
          });

          if (match) {
            const now = Date.now();
            const last = lastTriggerTimes[senderLower] || 0;
            if (now - last < TRIGGER_COOLDOWN_MS) {
              console.log(`${DEV_LOG_PREFIX} Skipping duplicate trigger for ${sender} (cooldown).`);
              // mark processed so we don't re-iterate infinitely, but don't mark as "read"
              row.dataset.extensionProcessed = '1';
              return;
            }
            lastTriggerTimes[senderLower] = now;

            console.log(`${DEV_LOG_PREFIX} Match found: ${sender}`);
            try {
              chrome.runtime.sendMessage({ type: 'alarm_trigger', from: sender, subject });
            } catch (e) {
              console.warn(`${DEV_LOG_PREFIX} sendMessage alarm_trigger failed:`, e);
            }

            // mark as visually processed to reduce repeats; do not tamper too aggressively
            try {
              row.dataset.extensionProcessed = '1';
              // optionally remove unread class to avoid repeated matches (uncomment if desired)
              // row.classList.remove('zE');
            } catch (e) {
              // ignore
            }
          }
        });
      };

      if (Array.isArray(providedRules) && providedRules.length > 0) {
        handleRules(providedRules);
      } else {
        // fallback to storage.local (background persists here)
        chrome.storage.local.get(['rules'], (data) => {
          const storedRules = Array.isArray(data.rules) ? data.rules : [];
          handleRules(storedRules);
        });
      }
    } catch (e) {
      console.error(`${DEV_LOG_PREFIX} checkGmail error:`, e);
    }
  }

  window.checkGmail = checkGmail;

  // --------------------
  // Refresh (click) logic
  // --------------------
  function findRefreshButton() {
    let btn = document.querySelector('div[aria-label="Refresh"]');
    if (btn) return btn;

    btn = document.querySelector('div[aria-label="Refresh mailbox"]');
    if (btn) return btn;

    // Fallback: look for data-tooltip or aria-label containing "refresh"
    const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (const b of buttons) {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const tooltip = (b.getAttribute('data-tooltip') || '').toLowerCase();
      if (aria.includes('refresh') || tooltip.includes('refresh')) return b;
    }
    return null;
  }

  function clickRefreshAndCheck(providedRules) {
    const btn = findRefreshButton();
    if (!btn) {
      console.warn(`${DEV_LOG_PREFIX} Refresh button not found; running check directly.`);
      checkGmail(providedRules);
      return;
    }

    try {
      console.log(`${DEV_LOG_PREFIX} Clicking Gmail refresh button...`);
      const listRoot = document.querySelector('div[role="main"]');
      const oldSnapshot = listRoot ? listRoot.innerHTML : null;

      // perform click
      btn.click();

      // Observe for changes in the inbox area
      if (listRoot) {
        let observed = false;
        const mo = new MutationObserver((mutations) => {
          if (observed) return;
          // If nodes added or innerHTML changed significantly, consider refresh complete
          for (const m of mutations) {
            if (m.addedNodes && m.addedNodes.length > 0) {
              observed = true;
              mo.disconnect();
              setTimeout(() => checkGmail(providedRules), 600);
              return;
            }
          }
          // fallback check via innerHTML length change
          if (oldSnapshot !== null) {
            const newSnapshot = listRoot.innerHTML;
            if (newSnapshot.length !== oldSnapshot.length) {
              observed = true;
              mo.disconnect();
              setTimeout(() => checkGmail(providedRules), 600);
            }
          }
        });
        mo.observe(listRoot, { childList: true, subtree: true });

        // Safety fallback: run check after 3s even if observer didn't detect change
        setTimeout(() => {
          try { mo.disconnect(); } catch (e) {}
          if (!observed) {
            console.log(`${DEV_LOG_PREFIX} Fallback timer reached; running checkGmail()`);
            checkGmail(providedRules);
          }
        }, 3000);
      } else {
        setTimeout(() => checkGmail(providedRules), 1200);
      }
    } catch (e) {
      console.warn(`${DEV_LOG_PREFIX} clickRefreshAndCheck error:`, e);
      setTimeout(() => checkGmail(providedRules), 1000);
    }
  }

  // --------------------
  // Message handling from background
  // --------------------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;

    if (msg.type === 'refresh_and_check') {
      // Accept rules passed from background; background now sends rules as well
      console.log(`${DEV_LOG_PREFIX} Received refresh_and_check`);
      // msg.rules may be provided
      clickRefreshAndCheck(Array.isArray(msg.rules) ? msg.rules : undefined);
      return true; // async
    }

    if (msg.type === 'play_sound') {
      console.log(`${DEV_LOG_PREFIX} Received play_sound for`, msg.from);
      injectAudioIframe();
      injectFallbackAudio();

      const iframeReady = new Promise((resolve) => {
        const onMsg = (ev) => {
          if (ev && ev.data && ev.data.type === 'IFRAME_READY') {
            window.removeEventListener('message', onMsg);
            resolve(true);
          }
        };
        window.addEventListener('message', onMsg);
        setTimeout(() => {
          try { window.removeEventListener('message', onMsg); } catch (e) {}
          resolve(false);
        }, 1000);
      });

      iframeReady.then(() => {
        playAlarmSound();
      });

      showVisualAlert(msg.from || 'Unknown');
      return true;
    }

    if (msg.type === 'stop_sound') {
      console.log(`${DEV_LOG_PREFIX} Received stop_sound`);
      stopAlarmSound();
      return true;
    }

    if (msg.type === 'test_sound') {
      console.log(`${DEV_LOG_PREFIX} Received test_sound`);
      injectAudioIframe();
      injectFallbackAudio();
      testAlarmShort();
      return true;
    }

    return false;
  });

  // --------------------
  // Startup: prepare audio, do not auto-start monitoring
  // --------------------
  injectAudioIframe();
  injectFallbackAudio();
  console.log(`${DEV_LOG_PREFIX} Content script initialized (waiting for background commands).`);
})();