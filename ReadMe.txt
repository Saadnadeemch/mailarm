<<< MAILARM – GMAIL ALARM EXTENSION >>>

MailArm automatically checks your Gmail for new emails
from selected senders or with specific keywords,
and alerts you with a sound and on-screen notification.

---

<<< HOW IT WORKS >>>

1. << SETUP AND RULES >>
   - You add one or more rules (email address and keyword).
   - These rules are saved in Chrome’s local storage for future use.

2. << BACKGROUND MONITORING >>
   - A background script runs on a timer using Chrome Alarms API.
   - It keeps checking Gmail even when the popup is closed.

3. << GMAIL SCANNING >>
   - A content script runs inside the Gmail page.
   - It refreshes the inbox and looks for unread emails that match your rules.

4. << TRIGGERING THE ALARM >>
   - When a match is found, it notifies the background script.
   - The background sends a command to play the alarm sound
     and display a visual alert on the Gmail screen.

5. << STOPPING THE ALARM >>
   - You can stop the alarm manually through the popup.
   - The system also prevents repeated triggers for the same sender for a short time.

6. << PERSISTENT STATE >>
   - All your settings, rules, and status are stored locally.
   - When Chrome restarts, the extension resumes from where it left off.

---

<<< CORE FEATURES >>>

- Monitors Gmail for matching emails
- Plays an alarm sound directly in Gmail
- Shows on-screen and desktop alerts
- Uses Chrome alarms for background checks
- Saves settings automatically and restores after restart
