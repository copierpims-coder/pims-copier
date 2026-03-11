# PracticeHub → PIMS Copier

One-click copy of prescription data from Chewy PracticeHub to your clipboard, ready to paste into any PIMS.

## Install (while pending Chrome Web Store approval)

1. Click the green **Code** button above → **Download ZIP**
2. Unzip the downloaded folder
3. Open `chrome://extensions` in Chrome
4. Toggle on **Developer mode** (top right)
5. Click **Load unpacked**
6. Select the unzipped folder (the one containing `manifest.json`)
7. Go to PracticeHub — the **Copy to PIMS** button will appear on any prescription review page

## How to Use

1. Open any prescription in PracticeHub and click **Review**
2. Click the blue **Copy to PIMS** button (next to View PDF)
3. Paste into your PIMS — done!

## Customize

Click the extension icon in your Chrome toolbar to:

- Choose which fields to include
- Pick your separator format (newline, tab, comma, or pipe)
- Toggle field labels on/off
- Enable/disable copy notifications

## Supported Prescription Types

- Approved prescriptions
- Declined prescriptions (with decline reason and internal notes)
- Compounded medications (with compound reasons)
- Veterinary Diet products (DT-prefixed Rx)

## Fields Extracted

Rx ID, Status, Date Written, Created On, Approved/Declined By, Email, Chewy Order #, Prescribing Vet, Reason to Decline, Internal Notes, Drug/Product Name, Expiration, Qty per Fill, Qty Remaining, Refills Remaining, Last Delivered, Instructions, Notes to Pharmacist, Compound Reasons, Submitted By, Patient Name, Client Name

## Privacy

All processing happens locally in your browser. No data is collected, stored, or transmitted externally. See our [Privacy Policy](https://copierpims-coder.github.io/pims-copier/privacy-policy.html).

## Support

Questions or issues? Email copierpims@gmail.com

---

⚠️ **Always verify.** This tool copies data from the PracticeHub screen as a workflow convenience. Always confirm copied fields against the original PracticeHub record before saving to your PIMS. Clinical accuracy is the responsibility of the reviewing veterinarian or credentialed staff member. Not affiliated with Chewy, Inc.
