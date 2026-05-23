# Annotated — Bounty Spec

Hard requirements from the Jason Calacanis $5,000 bounty. Non-negotiable.
Judging criterion: "the cleanest and most complete execution wins."

---

## Hard Requirements

### Chrome Sidebar Extension
The product must ship as a Chrome sidebar extension, not just a web app. The sidebar is the primary surface.

### "File a Claim" Button
Every annotation page must include a clearly visible button to dispute fair use breaches.

### Source Attribution
All clipped content — text, audio, or video — must link back to its original source URL.

---

## Technical Specifications

| Requirement | Value |
|---|---|
| Max clip duration | 90 seconds |
| Video resolution | 240p (< 480p) |
| Authentication | X (Twitter) or Google OAuth only. No email/password. |
| Supported content types | YouTube videos, news articles, podcasts |
| Commentary | Text and recorded audio, both supported |
| Feed | Public social feed with follow and comment |

---

## Full Spec Checklist

- [ ] Max clip size: 90 seconds
- [ ] Video downgraded to 240p
- [ ] Every clip links to its original source URL
- [ ] Visible "File a claim" button on every annotation page
- [ ] Each clip generates a public landing page (source link + claim button)
- [ ] Account creation via X or Google only
- [ ] Public social feed with follow and comment
- [ ] Commentary supports text and recorded audio
- [ ] Sidebar extension is the primary surface
