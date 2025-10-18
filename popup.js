document.addEventListener('DOMContentLoaded', () => {
    const targetEmailInput = document.getElementById('targetEmail');
    const keywordInput = document.getElementById('keyword');
    const startStopButton = document.getElementById('startStopButton');

    let isChecking = false;

    // --- State Management ---
    function updateUI(status, settings) {
        isChecking = status;
        
        // Update inputs with current settings
        targetEmailInput.value = settings.targetEmail || '';
        keywordInput.value = settings.keyword || '';

        // Update button appearance and text
        if (isChecking) {
            startStopButton.textContent = 'STOP Monitoring 🛑';
            startStopButton.classList.remove('start');
            startStopButton.classList.add('stop');
            // Disable inputs when running
            targetEmailInput.disabled = true;
            keywordInput.disabled = true;
        } else {
            startStopButton.textContent = 'START Monitoring ▶️';
            startStopButton.classList.remove('stop');
            startStopButton.classList.add('start');
            // Enable inputs when stopped
            targetEmailInput.disabled = false;
            keywordInput.disabled = false;
        }
    }

    // Load initial state from background script
    chrome.runtime.sendMessage({ type: "requestStatus" }, (response) => {
        if (response) {
            updateUI(response.status, response.settings);
        } else {
             // Default state if no response (e.g., service worker restart delay)
            updateUI(false, { targetEmail: "", keyword: "" }); 
        }
    });

    // Listen for status updates from the background script
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "statusUpdate") {
            updateUI(msg.isChecking, msg.settings);
        }
    });

    // --- Save Settings and Toggle Checking ---
    function saveSettings() {
        const targetEmail = targetEmailInput.value;
        const keyword = keywordInput.value;

        if (!targetEmail.trim()) {
            alert("Please enter a Source Email or Domain (e.g., upwork.com) before starting.");
            return false;
        }

        chrome.runtime.sendMessage({
            type: "updateSettings",
            targetEmail: targetEmail,
            keyword: keyword
        });
        return true;
    }

    startStopButton.addEventListener('click', () => {
        if (isChecking) {
            // Stop the checking
            chrome.runtime.sendMessage({ type: "stopChecking" }, () => {
                // UI update will be handled by the "statusUpdate" message from BG
            });
        } else {
            // Start the checking
            if (saveSettings()) {
                 chrome.runtime.sendMessage({ type: "startChecking" }, () => {
                    // UI update will be handled by the "statusUpdate" message from BG
                });
            }
        }
    });
});