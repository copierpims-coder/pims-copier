/**
 * PracticeHub → PIMS Copier — Content Script (v1.4)
 *
 * DOM PATTERNS (from live inspection of chewyhealth.com):
 *
 * 1. INVERTED: label is a CHILD of the value container.
 *    <div>03/10/2026 6:30PM           ← parent (value + label combined)
 *      <span>Date Written:</span>     ← child (label only)
 *    </div>
 *    Value = parent.textContent minus child.textContent
 *
 * 2. SIBLING: label and value are adjacent sibling elements.
 *    <div>Prescribing Veterinarian</div>  ← label
 *    <div>Shawn Budge</div>               ← value
 *
 * 3. BUTTON-SIBLING: label is inside a <button> (tooltip trigger), value is next non-tooltip sibling.
 *    <button><span>Qty per fill</span></button>
 *    <div role="tooltip">...</div>         ← skip
 *    <div>90 tablets</div>                 ← value
 *
 * BUG FIX v1.3: querySelectorAll returns parent BEFORE child in DOM order.
 * The parent's textContent includes the child label text, causing false matches.
 * Fix: for inverted pattern, only match elements whose textContent is SHORT
 * (close to the search term length), meaning it's the actual label child.
 *
 * PRESCRIPTION TYPES:
 * - Approved: standard fields + "Approved by:"
 * - Declined: "Declined by:" + "Reason to Decline"
 * - Compounded: extra "Compound reasons for use" section
 * - Veterinary Diet: DT prefix, "Veterinary Diet Product" label, simpler layout
 */

(function () {
  'use strict';

  const BUTTON_ID = 'pims-copier-btn';

  // ─── Field Definitions ───────────────────────────────────────────────

  const FIELD_DEFINITIONS = [
    // ── Header Fields (inverted pattern) ──
    {
      id: 'rxId',
      label: 'Rx ID',
      defaultEnabled: true,
      extract: (dialog) => {
        // Matches DG or DT prefixed IDs: DG125871493, DT105394443
        const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const text = walker.currentNode.textContent.trim();
          const match = text.match(/\b(D[GTgt]\d{6,})\b/);
          if (match) {
            // Prefer the one associated with "ID:" label
            const parent = walker.currentNode.parentElement;
            if (parent) {
              const childTexts = Array.from(parent.children).map(c => c.textContent.trim().toLowerCase());
              if (childTexts.some(t => t.startsWith('id'))) return match[1];
            }
          }
        }
        // Fallback: first DG/DT ID in the top portion of the dialog
        const topText = dialog.textContent.substring(0, 800);
        const m = topText.match(/\b(D[GT]\d{6,})\b/);
        return m ? m[1] : null;
      }
    },
    {
      id: 'approvalStatus',
      label: 'Status',
      defaultEnabled: true,
      extract: (dialog) => {
        // Status badge: standalone short text element near the top
        const statusTerms = ['approved', 'declined', 'new', 'pending', 'active', 'expired', 'follow-up'];
        const els = dialog.querySelectorAll('*');
        for (const el of els) {
          if (el.children.length > 0) continue;
          if (el.closest('#' + BUTTON_ID)) continue;
          const text = el.textContent.trim();
          if (text.length > 15) continue;
          if (statusTerms.includes(text.toLowerCase())) {
            // Verify it's near the TOP of the dialog (not a Prescription Details status)
            const rect = el.getBoundingClientRect();
            const dialogRect = dialog.getBoundingClientRect();
            if (dialogRect.height > 0 && (rect.top - dialogRect.top) < 200) {
              return text;
            }
          }
        }
        return null;
      }
    },
    {
      id: 'dateWritten',
      label: 'Date Written',
      defaultEnabled: true,
      extract: (dialog) => extractInvertedLabel(dialog, 'Date Written:')
    },
    {
      id: 'dateCreated',
      label: 'Created On',
      defaultEnabled: true,
      extract: (dialog) => extractInvertedLabel(dialog, 'Created on:')
    },
    {
      id: 'approvedDeclinedBy',
      label: 'Approved/Declined By',
      defaultEnabled: true,
      extract: (dialog) => {
        return extractInvertedLabel(dialog, 'Approved by:') ||
               extractInvertedLabel(dialog, 'Declined by:');
      }
    },
    {
      id: 'approverEmail',
      label: 'Email',
      defaultEnabled: false,
      extract: (dialog) => extractInvertedLabel(dialog, 'Email:')
    },
    {
      id: 'chewyOrderNumber',
      label: 'Chewy Order #',
      defaultEnabled: false,
      extract: (dialog) => {
        // "Chewy Order #" is a standalone element, value might be in a nearby element
        // or combined: "Chewy Order # 5113232723"
        const els = dialog.querySelectorAll('*');
        for (const el of els) {
          if (el.children.length > 3) continue;
          const text = el.textContent.trim();
          if (text.startsWith('Chewy Order #') || text.startsWith('Chewy Order#')) {
            const val = text.replace(/Chewy Order\s*#\s*/, '').trim();
            if (val && val !== '—' && val !== '-' && val.length > 0) return val;
            // Check next sibling
            const next = el.nextElementSibling;
            if (next) {
              // The next sibling might contain the DG ID nested, skip to find order #
              const nextText = next.textContent.trim();
              if (nextText.match(/^\d{5,}/)) return nextText;
            }
          }
        }
        return null;
      }
    },
    // ── Clinic Details ──
    {
      id: 'prescribingVet',
      label: 'Prescribing Vet',
      defaultEnabled: true,
      extract: (dialog) => extractSiblingLabel(dialog, 'Prescribing Veterinarian')
    },
    {
      id: 'reasonToDecline',
      label: 'Reason to Decline',
      defaultEnabled: true,
      extract: (dialog) => extractSiblingLabel(dialog, 'Reason to Decline')
    },
    {
      id: 'internalNotes',
      label: 'Internal Notes',
      defaultEnabled: true,
      extract: (dialog) => extractSiblingLabel(dialog, 'Internal Notes')
    },
    // ── Prescription Details ──
    {
      id: 'rxName',
      label: 'Rx (Drug/Product)',
      defaultEnabled: true,
      extract: (dialog) => {
        // Product name is the text element near the product thumbnail image
        // in the first Prescription Details section
        const imgs = dialog.querySelectorAll('img[alt*="roduct"], img[alt*="humbnail"]');
        // Only use the FIRST product image (skip Patient History section)
        const img = imgs.length > 0 ? imgs[0] : null;
        if (img) {
          // Walk siblings after the image
          let el = img.nextElementSibling;
          while (el) {
            const text = el.textContent.trim();
            if (isProductName(text)) return text;
            el = el.nextElementSibling;
          }
          // Try parent's siblings
          let parent = img.parentElement;
          if (parent) {
            let sib = parent.nextElementSibling;
            while (sib) {
              const text = sib.textContent.trim();
              if (isProductName(text)) return text;
              sib = sib.nextElementSibling;
            }
          }
        }
        return null;
      }
    },
    {
      id: 'expiration',
      label: 'Expiration',
      defaultEnabled: true,
      extract: (dialog) => extractFirstSiblingLabel(dialog, 'Expiration')
    },
    {
      id: 'qtyPerFill',
      label: 'Qty per Fill',
      defaultEnabled: true,
      extract: (dialog) => extractFirstButtonSibling(dialog, 'Qty per fill')
    },
    {
      id: 'qtyRemaining',
      label: 'Qty Remaining',
      defaultEnabled: true,
      extract: (dialog) => extractFirstButtonSibling(dialog, 'Qty remaining')
    },
    {
      id: 'refillsRemaining',
      label: 'Refills Remaining',
      defaultEnabled: true,
      extract: (dialog) => extractFirstSiblingLabel(dialog, 'Refills remaining')
    },
    {
      id: 'lastDelivered',
      label: 'Last Delivered',
      defaultEnabled: false,
      extract: (dialog) => extractFirstSiblingLabel(dialog, 'Last delivered')
    },
    // ── Usage Instructions ──
    {
      id: 'instructions',
      label: 'Instructions',
      defaultEnabled: true,
      extract: (dialog) => extractSiblingLabel(dialog, 'Instructions Printed On Label')
    },
    {
      id: 'pharmacistNotes',
      label: 'Notes to Pharmacist',
      defaultEnabled: false,
      extract: (dialog) => {
        const val = extractSiblingLabel(dialog, 'Notes to Pharmacist');
        return (val && val !== 'N/A') ? val : null;
      }
    },
    // ── Compounded Medication Fields ──
    {
      id: 'compoundReasons',
      label: 'Compound Reasons',
      defaultEnabled: true,
      extract: (dialog) => {
        // Collect all "Reason for Compound" entries
        const reasons = [];
        const els = Array.from(dialog.querySelectorAll('*'));
        for (let i = 0; i < els.length; i++) {
          const el = els[i];
          if (el.children.length > 0) continue;
          const text = el.textContent.trim();
          if (text === 'Reason for Compound') {
            // Next sibling = reason title (e.g., "Flavor", "Strength")
            const titleEl = el.nextElementSibling;
            if (titleEl) {
              const title = titleEl.textContent.trim();
              // Next sibling after title = description
              const descEl = titleEl.nextElementSibling;
              const desc = descEl ? descEl.textContent.trim() : '';
              if (title) {
                reasons.push(desc ? `${title} — ${desc}` : title);
              }
            }
          }
        }
        return reasons.length > 0 ? reasons.join('; ') : null;
      }
    },
    // ── Submitted By ──
    {
      id: 'submittedBy',
      label: 'Submitted By',
      defaultEnabled: false,
      extract: (dialog) => {
        const els = dialog.querySelectorAll('*');
        for (const el of els) {
          if (el.children.length > 0) continue;
          const text = el.textContent.trim();
          if (text === 'Submitted by:' || text === 'Submitted by') {
            const next = el.nextElementSibling;
            if (next) return next.textContent.trim();
            // Try parent's next sibling
            const pNext = el.parentElement?.nextElementSibling;
            if (pNext) return pNext.textContent.trim();
          }
        }
        return null;
      }
    },
    // ── Patient & Client (from sidebar) ──
    {
      id: 'patientName',
      label: 'Patient',
      defaultEnabled: false,
      extract: (dialog) => {
        const petName = extractSiblingLabel(dialog, 'Pet Name');
        if (!petName) return null;
        // Try to also get species from next sibling after the name
        const els = dialog.querySelectorAll('*');
        for (const el of els) {
          if (el.children.length > 0) continue;
          if (el.textContent.trim() === petName) {
            const species = el.nextElementSibling;
            if (species) {
              const s = species.textContent.trim();
              if (s.match(/^\(.*\)$/)) return `${petName} ${s}`;
            }
            return petName;
          }
        }
        return petName;
      }
    },
    {
      id: 'clientName',
      label: 'Client',
      defaultEnabled: false,
      extract: (dialog) => extractSiblingLabel(dialog, 'Client Name')
    }
  ];

  // ─── Extraction Helpers ──────────────────────────────────────────────

  /**
   * INVERTED extraction: Find a label CHILD element, then read the PARENT's
   * textContent minus the label text to get the value.
   *
   * KEY FIX: Only match elements whose textContent is CLOSE to the search term
   * length. This prevents matching the parent container (whose textContent
   * includes both label + value and is much longer).
   */
  function extractInvertedLabel(container, labelText) {
    const els = container.querySelectorAll('*');
    const lower = labelText.toLowerCase().trim();

    for (const el of els) {
      if (el.closest('#' + BUTTON_ID)) continue;

      const text = el.textContent.trim();
      const textLower = text.toLowerCase();

      // Must match the label text
      if (textLower !== lower && !textLower.startsWith(lower)) continue;

      // KEY: element text must be SHORT — close to the label length
      // This ensures we found the LABEL child, not the parent container
      if (text.length > labelText.length + 10) continue;

      // LEAF CHECK: The actual label element (e.g., <span>Approved by:</span>)
      // has 0 children. Container DIVs like <div>Approved by: -</div> have 1+
      // children and their textContent includes both label + value text.
      // Matching the container causes the PARENT lookup to go one level too high,
      // pulling in sibling field values (e.g., "Email" instead of approver name).
      if (el.children.length > 0) continue;

      // The VALUE is in the parent element's text, minus the label text
      const parent = el.parentElement;
      if (!parent) continue;

      const parentText = parent.textContent.trim();
      // Remove the label portion
      let value = parentText.replace(text, '').trim();
      // Clean up leading/trailing colons and whitespace (but preserve standalone dashes like "-" or "—")
      value = value.replace(/^[\s:]+/, '').replace(/[\s:]+$/, '').trim();

      if (value.length > 0 && value.length < 500 && value !== labelText) {
        // Normalize standalone dash variants to "—"
        if (value === '-' || value === '–') value = '—';
        return value;
      }
    }
    return null;
  }

  /**
   * SIBLING extraction: label element followed by value element as next sibling.
   * Returns the FIRST match found.
   *
   * v1.3.1 FIX: Validate that the value sibling is a LEAF value, not a
   * container wrapping multiple fields (e.g., the Qty section).
   * A real value is short, doesn't contain tooltip text or other field labels.
   */
  function extractSiblingLabel(container, labelText) {
    const els = container.querySelectorAll('*');
    const lower = labelText.toLowerCase();

    for (const el of els) {
      if (el.closest('#' + BUTTON_ID)) continue;

      const text = el.textContent.trim();
      const textLower = text.toLowerCase();

      // Match: exact or starts-with (for labels like "Notes to Pharmacist (optional)")
      if (textLower !== lower && !textLower.startsWith(lower)) continue;

      // LEAF CHECK: real label elements are leaves (0 children) or near-leaves (1 child like a span).
      // Wrapper divs that contain "Prescribing Veterinarian" + "—" would have 2+ children.
      if (el.children.length > 1) continue;

      // Text length must be close to label text (prevents matching containers)
      if (text.length > labelText.length + 15) continue;

      // Value is the next sibling
      const next = el.nextElementSibling;
      if (!next) continue;

      const val = next.textContent.trim();

      // VALIDATION: reject values that are clearly containers, not field values
      if (val.length === 0 || val.length > 300) continue;

      // Reject if value element has too many children (it's a container, not a value)
      if (next.children.length > 3) continue;

      // Reject if the value contains tooltip text or other field labels
      if (val.includes('Tooltip Available') || val.includes('Quantity of') ||
          val.includes('Number of') || val.includes('Qty per fill') ||
          val.includes('Qty remaining') || val.includes('Refills remaining') ||
          val.includes('Reason to Decline') || val.includes('Internal Notes') ||
          val.includes('Prescribing Veterinarian')) continue;

      return val;
    }
    return null;
  }

  /**
   * FIRST-SIBLING extraction: same as sibling, but ensures we only grab
   * the FIRST instance (for fields like "Expiration" that repeat in
   * Patient History / Patient Prescriptions sections).
   */
  function extractFirstSiblingLabel(container, labelText) {
    return extractSiblingLabel(container, labelText);
  }

  /**
   * BUTTON-SIBLING extraction: label is inside a <button>, value is the
   * button's next sibling (skipping tooltip elements).
   * Only returns the FIRST match.
   */
  function extractFirstButtonSibling(container, labelText) {
    const buttons = container.querySelectorAll('button');
    const lower = labelText.toLowerCase();
    let found = false;

    for (const btn of buttons) {
      if (btn.id === BUTTON_ID) continue;

      const btnText = btn.textContent.trim().toLowerCase();
      if (btnText !== lower && !btnText.includes(lower)) continue;

      // Only use the first match (skip Patient History duplicates)
      if (found) continue;
      found = true;

      // Walk siblings after the button, skipping tooltips
      let next = btn.nextElementSibling;
      let attempts = 0;
      while (next && attempts < 5) {
        // Skip tooltip elements
        const role = (next.getAttribute('role') || '').toLowerCase();
        const text = next.textContent.trim();
        if (role === 'tooltip' || text.startsWith('Tooltip') ||
            text.startsWith('Quantity of') || text.startsWith('Number of')) {
          next = next.nextElementSibling;
          attempts++;
          continue;
        }
        if (text.length > 0 && text.length < 500) return text;
        break;
      }
    }
    return null;
  }

  /**
   * Check if text looks like a product name.
   */
  function isProductName(text) {
    if (!text || text.length < 10 || text.length > 400) return false;
    if (text.startsWith('Prescription') || text.startsWith('Expiration') ||
        text.startsWith('Qty') || text.startsWith('Last') ||
        text.startsWith('Refills') || text.startsWith('No Chewy') ||
        text.startsWith('Order') || text === 'Active' || text === 'Declined') return false;
    // Product names typically contain these keywords
    const productKeywords = ['tablet', 'capsule', 'chewable', 'topical', 'solution',
      'injection', 'gel', 'cream', 'ointment', 'suspension', 'liquid', 'powder',
      'mg', 'ml', 'ml,', 'lbs', 'supply', 'generic', 'brand',
      'food', 'diet', 'bag', 'can', 'case', 'tube', 'box', 'dose'];
    const lower = text.toLowerCase();
    return productKeywords.some(k => lower.includes(k));
  }

  // ─── Main Extraction ─────────────────────────────────────────────────

  function extractAllFields(dialog) {
    const results = [];
    for (const field of FIELD_DEFINITIONS) {
      if (!currentSettings.enabledFields.includes(field.id)) continue;
      try {
        const value = field.extract(dialog);
        if (value && value.trim().length > 0) {
          results.push({ id: field.id, label: field.label, value: value.trim() });
        }
      } catch (err) {
        console.warn(`[PIMS Copier] Error extracting ${field.id}:`, err);
      }
    }
    return results;
  }

  // ─── Settings ───────────────────────────────────────────────────────

  const DEFAULT_SETTINGS = {
    enabledFields: FIELD_DEFINITIONS.filter(f => f.defaultEnabled).map(f => f.id),
    separator: 'newline',
    includeLabels: true,
    showNotification: true
  };

  let currentSettings = { ...DEFAULT_SETTINGS };

  function loadSettings() {
    return new Promise((resolve) => {
      try {
        if (chrome?.storage?.sync) {
          chrome.storage.sync.get('pimsSettings', (result) => {
            try {
              if (chrome.runtime.lastError) {
                console.warn('[PIMS Copier] Storage read error:', chrome.runtime.lastError.message);
                resolve(currentSettings);
                return;
              }
              if (result && result.pimsSettings) {
                const validIds = new Set(FIELD_DEFINITIONS.map(f => f.id));
                const savedFields = result.pimsSettings.enabledFields || [];
                const validSavedFields = savedFields.filter(id => validIds.has(id));

                if (validSavedFields.length === 0) {
                  currentSettings = { ...DEFAULT_SETTINGS };
                  try { chrome.storage.sync.set({ pimsSettings: currentSettings }); } catch (e) {}
                } else {
                  currentSettings = {
                    ...DEFAULT_SETTINGS,
                    ...result.pimsSettings,
                    enabledFields: validSavedFields
                  };
                }
              }
              resolve(currentSettings);
            } catch (cbErr) {
              // Extension context invalidated inside callback
              console.warn('[PIMS Copier] Extension context lost — reload the page.');
              resolve(currentSettings);
            }
          });
        } else {
          resolve(currentSettings);
        }
      } catch (e) {
        // Extension context invalidated (extension was reloaded)
        console.warn('[PIMS Copier] Extension context lost — reload the page.');
        resolve(currentSettings);
      }
    });
  }

  try {
    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.pimsSettings) {
          currentSettings = { ...DEFAULT_SETTINGS, ...changes.pimsSettings.newValue };
        }
      });
    }
  } catch (e) {
    // Extension context invalidated — safe to ignore
  }

  // ─── Clipboard ──────────────────────────────────────────────────────

  function formatForClipboard(fields) {
    const separatorMap = { newline: '\n', tab: '\t', comma: ', ', pipe: ' | ' };
    const sep = separatorMap[currentSettings.separator] || '\n';
    return fields.map(f => currentSettings.includeLabels ? `${f.label}: ${f.value}` : f.value).join(sep);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch (e2) {
        console.error('[PIMS Copier] Clipboard failed:', e2);
        return false;
      }
    }
  }

  // ─── Toast ──────────────────────────────────────────────────────────

  function showToast(message, isError = false) {
    const existing = document.getElementById('pims-copier-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'pims-copier-toast';
    toast.className = `pims-copier-toast ${isError ? 'pims-copier-toast-error' : 'pims-copier-toast-success'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('pims-copier-toast-visible'));
    setTimeout(() => {
      toast.classList.remove('pims-copier-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ─── Button ─────────────────────────────────────────────────────────

  function createCopyButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.className = 'pims-copier-btn';
    btn.type = 'button';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle;">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy to PIMS</span>
    `;
    btn.addEventListener('click', handleCopyClick);
    return btn;
  }

  async function handleCopyClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const btn = document.getElementById(BUTTON_ID);
    const dialog = findReviewDialog();
    if (!dialog) {
      showToast('Review panel not found', true);
      return;
    }
    try { await loadSettings(); } catch (err) {
      console.warn('[PIMS Copier] Settings load failed, using defaults.');
    }
    const fields = extractAllFields(dialog);

    if (fields.length === 0) {
      showToast('No fields found — check extension settings', true);
      return;
    }

    const formatted = formatForClipboard(fields);
    const success = await copyToClipboard(formatted);
    if (success) {
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Copied ${fields.length} fields!</span>
        `;
        btn.classList.add('pims-copier-btn-success');
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.classList.remove('pims-copier-btn-success');
        }, 2000);
      }
      if (currentSettings.showNotification) {
        showToast(`Copied ${fields.length} fields to clipboard`);
      }
      console.log('[PIMS Copier] Copied:', fields.map(f => `${f.label}: ${f.value}`).join(' | '));
    } else {
      showToast('Clipboard failed — check permissions', true);
    }
  }

  // ─── Dialog Detection ───────────────────────────────────────────────

  function findReviewDialog() {
    // Strategy 1: native dialog or role="dialog"
    const dialogs = document.querySelectorAll('dialog, [role="dialog"]');
    for (const d of dialogs) {
      if (d.textContent.includes('View PDF') || d.textContent.includes('Prescription')) return d;
    }
    // Strategy 2: fixed/absolute high z-index container with Review content
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const style = window.getComputedStyle(div);
      if (style.position !== 'fixed' && style.position !== 'absolute') continue;
      const z = parseInt(style.zIndex);
      if (isNaN(z) || z < 10) continue;
      if (div.textContent.includes('View PDF')) return div;
    }
    // Strategy 3: walk up from View PDF link
    const links = document.querySelectorAll('a, button');
    for (const link of links) {
      if (link.textContent.trim().includes('View PDF')) {
        let parent = link.parentElement;
        let depth = 0;
        while (parent && depth < 20) {
          if (parent.tagName === 'DIALOG' || parent.getAttribute('role') === 'dialog') return parent;
          const style = window.getComputedStyle(parent);
          if ((style.position === 'fixed' || style.position === 'absolute') &&
              parent.offsetWidth > 400 && parent.offsetHeight > 300) return parent;
          parent = parent.parentElement;
          depth++;
        }
      }
    }
    return null;
  }

  // ─── Button Injection ───────────────────────────────────────────────

  function findViewPdfElement() {
    const els = document.querySelectorAll('a, button, [role="button"]');
    for (const el of els) {
      if (el.textContent.trim().includes('View PDF')) return el;
    }
    return null;
  }

  function injectButton() {
    const existing = document.getElementById(BUTTON_ID);
    const dialog = findReviewDialog();

    if (existing) {
      if (!dialog) { existing.remove(); return; }
      if (dialog.contains(existing)) return;
      existing.remove();
    }
    if (!dialog) return;

    const btn = createCopyButton();
    const viewPdf = findViewPdfElement();
    if (viewPdf && dialog.contains(viewPdf)) {
      const anchor = viewPdf.closest('a') || viewPdf;
      const parent = anchor.parentElement;
      if (parent) {
        parent.insertBefore(btn, anchor.nextSibling);
        return;
      }
    }
    dialog.insertBefore(btn, dialog.firstChild);
  }

  // ─── MutationObserver ───────────────────────────────────────────────

  let debounceTimer = null;
  function onDomChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => injectButton(), 400);
  }

  function startObserver() {
    const observer = new MutationObserver(onDomChange);
    observer.observe(document.body, { childList: true, subtree: true });
    onDomChange();
  }

  async function init() {
    await loadSettings();
    startObserver();
    console.log('[PIMS Copier] v1.4 loaded.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
