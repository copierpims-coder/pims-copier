# PracticeHub → PIMS Copier

> **Retired — September 2026.** The PIMS Copier feature is now a PracticeHub product enhancement because of your feedback. Use the **Copy prescription details** feature in the **disposition section** of any prescription review. Nothing to install, nothing to keep updated.

## If you still have the extension installed

It no longer does anything. Version 2.0.0 removed the **Copy to PIMS** button and shows a single dismissible notice for a few days, then goes silent. You can remove it whenever you like: right-click the extension icon in Chrome → **Remove from Chrome…**

The Chrome Web Store listing has been taken down; there is nothing to install from this repository.

## What this was

A Chrome extension (v1.0 – v1.5) that added a one-click **Copy to PIMS** button to the PracticeHub prescription review panel, copying selected fields — Rx ID, status, prescribing vet, drug, quantities, refills, instructions, decline reasons, compound reasons — to the clipboard in a format ready to paste into any practice management system. It ran entirely in the browser and never transmitted data anywhere.

Clinic feedback on this workaround is a real part of why the feature was built into the product. Thank you to everyone who used it and told us what was missing.

## Source history

The last functional release is tagged `v1.5.0`. Version `2.0.0` is the retirement build: `manifest.json`, `sunset.js`, `sunset.css`, `popup.html`, and icons only — one `storage` permission and no host permissions.

## Privacy

The [Privacy Policy](https://copierpims-coder.github.io/pims-copier/privacy-policy.html) remains available for reference.

## Support

copierpims@gmail.com

---

Not affiliated with Chewy, Inc.
