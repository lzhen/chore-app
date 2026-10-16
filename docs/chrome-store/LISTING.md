# Nesmi 1.0.1 — first Chrome Web Store submission draft

Status: NOT SUBMITTED. No extension ID or review decision confirmed.

Name: Nesmi
Category: Productivity
Summary: Keep a private household checklist in your browser. Add, complete, and remove chores offline.

Description:
Keep small household tasks within reach from the Chrome toolbar. Add a chore, mark it complete, delete individual tasks, or clear completed chores directly in the extension. Your checklist stays in this browser profile and works offline. No account is required.

This first version does not sync tasks with the Nesmi website, assign tasks to family members, or provide reminders. The optional website link opens https://empathie.ai/nesmi/ separately.

Single purpose: Maintain a local household chore checklist in the toolbar popup.
Permissions: none. No host permissions, content scripts, background workers, analytics, or remote code. LocalStorage holds user-entered chore text, completion state, and random IDs. No checklist data leaves the extension.

Privacy disclosures: Disclose local handling of user-generated chore text even though nothing is transmitted. Do not describe this as handling no user data. Confirm the exact current dashboard category wording before selecting data fields. No sale, ads, unrelated use, or transfers. Website use is separate.

Privacy policy: chrome-extension/privacy.html contains the matching policy. Publish it at a stable public URL before submission and enter that URL in the designated privacy field. A bundled page alone is insufficient.

Review instructions: Open toolbar popup, add a task, close/reopen, mark it complete, clear completed. Add another task and delete it. Repeat offline. No login or test account needed.

Outstanding release gates:
- Actual Chrome load-unpacked / ZIP installation and popup verification (not yet performed).
- Capture real extension screenshots at accepted store dimensions; verify icon appearance.
- Publicly host and check privacy URL.
- Verify live product/support links, developer identity, account access and 2-step verification.
- Upload ZIP, complete dashboard disclosures and submit; retain extension ID and dashboard status.

Policy sources:
https://developer.chrome.com/docs/webstore/program-policies/minimum-functionality
https://developer.chrome.com/docs/webstore/program-policies/listing-requirements
https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
