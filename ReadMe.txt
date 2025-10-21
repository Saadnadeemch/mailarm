/*  
===========================================================
             <<< MAILARM — GMAIL ALARM EXTENSION >>>
===========================================================

Note:  
This extension does not use any third-party service or Gmail’s official API.  
It works purely through a safe DOM-based scraping method that refreshes your Gmail page, 
detects new emails via selectors, and triggers alerts when a match is found.  
You can freely check the source code — it’s completely transparent and secure.

MailArm automatically checks your Gmail for new emails 
from specific senders or with certain keywords, and alerts 
you instantly with a sound and an on-screen notification.

-----------------------------------------------------------
                 <<< SETUP INSTRUCTIONS >>>
-----------------------------------------------------------

To ensure the extension works properly, follow these steps:

1️⃣ Enable Sound Permission:  
   → Open this link:  
     chrome://settings/content/siteDetails?site=https%3A%2F%2Fmail.google.com  
   → Turn ON the “Sound” option for Gmail.

2️⃣ Optional (Recommended for Freelancers):  
   → If you’re using MailArm to get instant alerts from freelancing platforms 
     like Fiverr or Upwork, open their notification settings and set  
     “Email Delivery” to “Immediate” instead of “5–10 minutes.”

-----------------------------------------------------------
                    <<< HOW IT WORKS >>>
-----------------------------------------------------------

1️⃣ SETUP AND RULES  
   - Add one or more rules (email address + keyword).  
   - These rules are automatically saved in Chrome’s local storage.

2️⃣ BACKGROUND MONITORING  
   - A background process checks Gmail every few seconds.  
   - It continues running even when the popup is closed.

3️⃣ GMAIL SCANNING  
   - The extension refreshes your Gmail inbox automatically.  
   - It looks for unread emails that match your rules.

4️⃣ TRIGGERING THE ALARM  
   - When a matching email is found, it plays an alarm sound  
     and shows an alert message on your Gmail screen.

5️⃣ STOPPING THE ALARM  
   - You can stop the alarm manually from the popup.  
   - The system prevents multiple triggers for the same sender  
     within a short time.

6️⃣ SAVED SETTINGS  
   - All rules and preferences are stored locally.  
   - When Chrome restarts, everything resumes automatically.

-----------------------------------------------------------
                    <<< CORE FEATURES >>>
-----------------------------------------------------------

✅ Monitors Gmail for selected senders or keywords  
✅ Plays an alarm sound directly in Gmail  
✅ Displays on-screen and desktop alerts  
✅ Works silently in the background  
✅ Saves and restores your rules automatically  

-----------------------------------------------------------
                    <<< CUSTOM SOUND >>>
-----------------------------------------------------------

To use a different alarm sound:  
   → Delete the existing 'alarm.mp3' file.  
   → Replace it with your own audio file named 'alarm.mp3'.

-----------------------------------------------------------
                      <<< END OF FILE >>>
===========================================================
*/
