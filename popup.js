
(function () {
  const settingsBtn = document.getElementById('settings-btn');
  const monitorView = document.getElementById('monitor-view');
  const settingsView = document.getElementById('settings-view');

  const statusMessage = document.getElementById('status-message');
  const startStopButton = document.getElementById('startStopButton');
  const stopAlarmButton = document.getElementById('stopAlarmButton');
  const ruleCount = document.getElementById('rule-count');

  const ruleList = document.getElementById('rule-list');
  const noRulesMsg = document.getElementById('no-rules-msg');
  const inputEmail = document.getElementById('input-email');
  const inputKeyword = document.getElementById('input-keyword');
  const addRuleBtn = document.getElementById('add-rule-btn');
  const backToMonitorBtn = document.getElementById('back-to-monitor-btn');
  const ruleFeedback = document.getElementById('rule-feedback');

  // --- STATE ---
  let isChecking = false;
  let rules = [];

  // --- Helpers ---
  function pluralize(n, singular, plural) {
    return n === 1 ? singular : plural;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function isValidEmailOrDomain(s) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const domainRe = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    return emailRe.test(s) || domainRe.test(s);
  }

  // --- VIEW MANAGEMENT ---
  function showMonitorView() {
    monitorView.classList.remove('hidden');
    settingsView.classList.add('hidden');
  }
  function showSettingsView() {
    monitorView.classList.add('hidden');
    settingsView.classList.remove('hidden');
    renderRuleList();
  }
  settingsBtn.addEventListener('click', showSettingsView);
  backToMonitorBtn.addEventListener('click', showMonitorView);

  function updateUI(state) {
    isChecking = Boolean(state && state.status);
    rules = Array.isArray(state && state.rules) ? state.rules : rules;

    ruleCount.textContent = rules.length;

    const hostsText = `Listening to ${rules.length} defined ${pluralize(rules.length, 'host', 'hosts')}`;
    statusMessage.textContent = hostsText;

    if (isChecking) {
      startStopButton.textContent = 'STOP Monitoring';
      startStopButton.classList.remove('start');
      startStopButton.classList.add('stop');
    } else {
      startStopButton.textContent = 'START Monitoring';
      startStopButton.classList.remove('stop');
      startStopButton.classList.add('start');
    }

    if (state && state.alarmRinging) {
      stopAlarmButton.style.display = '';
    } else {
      stopAlarmButton.style.display = 'none';
    }

    if (!settingsView.classList.contains('hidden')) renderRuleList();
  }

  function renderRuleList() {
    ruleList.innerHTML = '';
    if (!rules || rules.length === 0) {
      noRulesMsg.style.display = '';
      ruleList.appendChild(noRulesMsg);
      return;
    }
    noRulesMsg.style.display = 'none';
    rules.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'rule-item';
      div.innerHTML = `<div>
                          <div style="font-weight:700">${escapeHtml(r.email)}</div>
                          <div style="font-size:12px;color:var(--muted)">${escapeHtml(r.keyword || 'Any')}</div>
                       </div>
                       <div>
                         <button class="delete-rule-btn" data-index="${i}" title="Delete">🗑️</button>
                       </div>`;
      ruleList.appendChild(div);
    });
  }

  // --- USER ACTIONS ---
  startStopButton.addEventListener('click', () => {
    // console.log('[Popup] startStop clicked; isChecking=', isChecking);
    if (isChecking) {
      chrome.runtime.sendMessage({ type: 'stopChecking' }, (resp) => {
        // console.log('[Popup] stopChecking response', resp, chrome.runtime.lastError);
      });
    } else {
      if (!rules || rules.length === 0) {
        ruleFeedback.textContent = '⚠️ Please add at least one host before starting.';
        ruleFeedback.style.color = 'var(--danger)';
        showSettingsView();
        return;
      }
      chrome.runtime.sendMessage({ type: 'startChecking' }, (resp) => {
        // console.log('[Popup] startChecking response', resp, chrome.runtime.lastError);
      });
    }
  });

  stopAlarmButton.addEventListener('click', () => {
    // console.log('[Popup] stopAlarm clicked');
    chrome.runtime.sendMessage({ type: 'stopAlarm' }, (resp) => {
      // console.log('[Popup] stopAlarm response', resp, chrome.runtime.lastError);
    });
  });

  addRuleBtn.addEventListener('click', () => {
    const email = inputEmail.value.trim();
    const keyword = inputKeyword.value.trim();
    // console.log('[Popup] addRule attempt', email, keyword);

    if (!email) {
      ruleFeedback.textContent = '⚠️ Enter email or domain.';
      ruleFeedback.style.color = 'var(--danger)';
      return;
    }
    if (!isValidEmailOrDomain(email)) {
      ruleFeedback.textContent = '⚠️ Invalid email/domain format.';
      ruleFeedback.style.color = 'var(--danger)';
      return;
    }

    if (rules.some(r => r.email.toLowerCase() === email.toLowerCase() && (r.keyword || '') === (keyword || ''))) {
      ruleFeedback.textContent = '⚠️ Duplicate rule.';
      ruleFeedback.style.color = '#b45309'; // amber
      return;
    }

    rules.push({ email, keyword });
    chrome.storage.local.set({ rules }, () => {
      // console.log('[Popup] rules persisted', rules);
      chrome.runtime.sendMessage({ type: 'updateRules', rules }, (resp) => {
        // console.log('[Popup] updateRules -> background', resp, chrome.runtime.lastError);
      });
      ruleFeedback.textContent = `✅ Added: ${email}`;
      ruleFeedback.style.color = 'var(--accent-dark)';
      inputEmail.value = '';
      inputKeyword.value = '';
      renderRuleList();
      ruleCount.textContent = rules.length;
    });
  });

  ruleList.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('delete-rule-btn')) {
      const idx = parseInt(e.target.dataset.index, 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < rules.length) {
        rules.splice(idx, 1);
        chrome.storage.local.set({ rules }, () => {
          chrome.runtime.sendMessage({ type: 'updateRules', rules }, (resp) => {
            // console.log('[Popup] updateRules after delete', resp, chrome.runtime.lastError);
          });
          renderRuleList();
          ruleCount.textContent = rules.length;
          ruleFeedback.textContent = '🗑️ Rule deleted';
          ruleFeedback.style.color = '#6b7280';
        });
      }
    }
  });

  // --- INIT ---
  chrome.storage.local.get(['rules'], (data) => {
    rules = Array.isArray(data.rules) ? data.rules : [];
    // console.log('[Popup] loaded rules', rules);
    chrome.runtime.sendMessage({ type: 'requestStatus' }, (resp) => {
      // console.log('[Popup] requestStatus response', resp);
      updateUI(resp || { status: false, rules });
    });
  });

  // --- LISTEN TO BACKGROUND ---
  chrome.runtime.onMessage.addListener((msg) => {
    // console.log('[Popup] runtime.onMessage', msg);
    if (!msg || !msg.type) return;
    if (msg.type === 'statusUpdate') {
      updateUI({ status: msg.isChecking, rules: msg.rules, alarmRinging: msg.alarmRinging });
    } else if (msg.type === 'alarmTriggered' || msg.type === 'alarm_triggered') {
      updateUI({ status: isChecking, rules, alarmRinging: true });
    }
  });

  // expose minimal debug hook (no console logs by default)
  window.popupDebug = { updateUI };
})();