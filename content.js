// content.js

(function checkGmail() {
  console.log("[Content] Checking Gmail...");

  // Retrieve settings from storage
  chrome.storage.sync.get(["targetEmail", "keyword"], ({ targetEmail, keyword }) => {
    // Sanitize and normalize settings for case-insensitive comparison
    const targetEmailLower = targetEmail ? targetEmail.trim().toLowerCase() : "";
    const keywordLower = keyword ? keyword.trim().toLowerCase() : "";

    // Safety check: Don't proceed if no target email is set
    if (!targetEmailLower) {
        console.log("[Content] No target email set in settings. Skipping email check.");
        return;
    }

    // New, more reliable selector for unread email rows in the primary inbox
    // .zA is the class for a standard email row.
    // .zE is the class typically denoting an unread email.
    // :not(.zz) excludes selected or dragging rows.
    const emailRows = document.querySelectorAll(".zA.zE:not(.zz)");

    if (emailRows.length === 0) {
        console.log("[Content] No new unread emails found on the page.");
    }

    emailRows.forEach(row => {
      
      // 1. Extract Sender Information
      // Try to find the element containing the sender's actual email address (often in an 'email' attribute)
      const senderElement = row.querySelector(".yX.xY span[email]");
      
      // Prioritize the email attribute, falling back to the displayed text (name or partial email)
      const sender = senderElement?.getAttribute("email") || row.querySelector(".yX.xY span")?.textContent || "";

      // 2. Extract Subject Information
      const subject = row.querySelector(".y6 span")?.textContent || "";

      if (!sender) return; // Skip if we can't determine the sender

      const senderLower = sender.toLowerCase();
      const subjectLower = subject.toLowerCase();
      
      // --- Matching Logic ---
      
      // 1. Match Email/Domain: Check if the sender (email or domain) contains the target setting.
      // This is case-insensitive, e.g., 'upwork.com' matches 'Upwork <noreply@upwork.com>'
      const matchEmail = senderLower.includes(targetEmailLower);

      // 2. Match Keyword: (Optional) If a keyword is provided, the subject must include it. 
      // If no keyword is set, it defaults to true.
      const matchKeyword = !keywordLower || subjectLower.includes(keywordLower);

      // --- Trigger Alarm ---
      
      if (matchEmail && matchKeyword) {
        console.log(`[Content] Found target match! Sender: ${sender}, Subject: ${subject}`);
        
        // Send a message to the background script to trigger the alarm and notification
        chrome.runtime.sendMessage({ type: "alarm_trigger", from: sender });
        
        // OPTIMIZATION: Visually mark the email row as 'read' in the UI 
        // by removing the unread class. This prevents the alarm from constantly 
        // triggering on the same email during the next periodic check, 
        // without actually modifying Gmail's state on the server.
        row.classList.remove("zE"); 
      }
    });
  });
})();