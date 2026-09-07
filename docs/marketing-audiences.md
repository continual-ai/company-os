# Marketing audiences

A contact's marketing status records whether the team intends to include them in marketing.
It does not establish permission to email them. New and migrated contacts are non-marketing by
default; existing consent values are preserved.

Marketing email consent is recorded separately. Changing marketing status never changes consent.
The **Marketing contacts** view includes contacts designated for marketing. The **Marketing email
audience** view additionally requires recorded opt-in and an email address. These are editable
collection filters, not an authorization or delivery boundary.

Campaigns, enrollments, and outreach currently track work; saving those records does not send
email. Contact preferences do not implement email-address subscription history, unsubscribe
processing, bounce suppression, or provider delivery checks. A sending integration must enforce
recipient eligibility at dispatch through its governed server action, independently of the view
used to select recipients.
