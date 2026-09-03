/**
 * PracticeHub → PIMS Copier — v2.0.0 (final release: retirement build)
 *
 * Copy to PIMS is now a built-in PracticeHub feature, so this version:
 *   • removes the blue "Copy to PIMS" button and everything behind it
 *   • shows ONE dismissible notice pointing clinics at the built-in control
 *   • goes completely silent after SHOW_FOR_DAYS or one dismissal — whichever
 *     comes first — and never again after HARD_STOP, no matter what
 *
 * Nothing in this file reads prescription data, touches the clipboard, or
 * observes the page. After expiry it is inert and the extension can be removed.
 */
(function () {
  'use strict';

  // ── The only three things you'd ever edit ──────────────────────────────────
  const NOTICE_TEXT   = 'The PIMS Copier feature is now a PracticeHub product enhancement ' +
                        'because of your feedback. This extension is now retired and will be ' +
                        'removed from Chrome. You can now use the Copy prescription details ' +
                        'feature in the disposition section.';
  const SHOW_FOR_DAYS = 5;                                   // per clinic, from the first run of this version
  const HARD_STOP     = Date.parse('2026-10-01T00:00:00Z');  // absolute ceiling, whatever the rollout timing
  // ───────────────────────────────────────────────────────────────────────────

  const STATE_KEY = 'pimsSunset';
  const BANNER_ID = 'pims-sunset-notice';
  const DAY_MS    = 864e5;

  let banner = null;
  let observer = null;
  let rehomeTimer = null;
  let dismissed = false;

  if (Date.now() >= HARD_STOP) return;
  if (!(window.chrome && chrome.storage && chrome.storage.local)) return;

  chrome.storage.local.get(STATE_KEY, (res) => {
    const state = (res && res[STATE_KEY]) || {};
    if (state.dismissed) return;

    let firstSeen = state.firstSeen;
    if (!firstSeen) {
      firstSeen = Date.now();
      chrome.storage.local.set({ [STATE_KEY]: { firstSeen, dismissed: false } });
      cleanupOldData();
    }

    if (Date.now() - firstSeen > SHOW_FOR_DAYS * DAY_MS) return;

    whenBodyReady(showNotice);
  });

  // Remove settings and survey state left behind by 1.x. Best-effort; never throws.
  function cleanupOldData() {
    try { chrome.storage.sync && chrome.storage.sync.remove('pimsSettings'); } catch (e) {}
    try { chrome.storage.local.remove('surveyState'); } catch (e) {}
  }

  function whenBodyReady(fn) {
    if (document.body) return fn();
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  // PracticeHub's Review drawer is a modal with a focus trap: clicks that land
  // outside it are swallowed at the document level. So the notice mounts INSIDE
  // the open dialog when there is one, and uses the top-layer popover API so it
  // sits above any overlay. A light observer re-homes it if the dialog opens,
  // closes, or re-renders underneath it.

  function findOpenDialog() {
    const candidates = document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"]');
    for (let i = candidates.length - 1; i >= 0; i--) {
      const el = candidates[i];
      if (el === banner || (banner && banner.contains(el))) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 200 && r.height > 200) return el;   // visible, real dialog
    }
    return null;
  }

  function mountTarget() {
    return findOpenDialog() || document.body;
  }

  function showNotice() {
    if (dismissed) return;
    if (!banner) banner = buildBanner();
    placeBanner();
    if (!observer && window.MutationObserver) {
      observer = new MutationObserver(() => {
        clearTimeout(rehomeTimer);
        rehomeTimer = setTimeout(placeBanner, 300);
      });
      observer.observe(document.body, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['style', 'class', 'open', 'hidden', 'aria-modal']
      });
    }
  }

  function placeBanner() {
    if (dismissed || !banner) return;
    const target = mountTarget();
    if (banner.parentElement !== target) {
      target.appendChild(banner);                 // moving closes a popover; reopen below
      if (typeof banner.showPopover === 'function') {
        try { banner.showPopover(); } catch (e) {}
      }
      requestAnimationFrame(() => banner.classList.add('pims-sunset-notice-visible'));
    }
  }

  function buildBanner() {
    const el = document.createElement('div');
    el.id = BANNER_ID;
    el.className = 'pims-sunset-notice';
    el.setAttribute('role', 'status');
    if ('popover' in el) el.setAttribute('popover', 'manual');   // top layer, above overlays

    const text = document.createElement('span');
    text.className = 'pims-sunset-text';
    text.textContent = NOTICE_TEXT;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pims-sunset-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    // Listen on pointerdown as well as click: focus-trap libraries cancel
    // "outside" clicks in the capture phase, but pointerdown still arrives.
    const onDismiss = (e) => { e.preventDefault(); e.stopPropagation(); dismiss(); };
    close.addEventListener('pointerdown', onDismiss);
    close.addEventListener('click', onDismiss);

    el.appendChild(text);
    el.appendChild(close);
    return el;
  }

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    chrome.storage.local.get(STATE_KEY, (res) => {
      const state = (res && res[STATE_KEY]) || {};
      chrome.storage.local.set({ [STATE_KEY]: Object.assign({}, state, { dismissed: true }) });
    });
    removeNotice();
  }

  function removeNotice() {
    if (observer) { observer.disconnect(); observer = null; }
    clearTimeout(rehomeTimer);
    const el = banner || document.getElementById(BANNER_ID);
    if (!el) return;
    el.classList.remove('pims-sunset-notice-visible');
    setTimeout(() => {
      try { if (typeof el.hidePopover === 'function') el.hidePopover(); } catch (e) {}
      el.remove();
    }, 300);
    banner = null;
  }

  // Dismissed in one tab → disappears from every other open PracticeHub tab.
  if (chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STATE_KEY] && changes[STATE_KEY].newValue &&
          changes[STATE_KEY].newValue.dismissed) {
        dismissed = true;
        removeNotice();
      }
    });
  }
})();
