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

  function showNotice() {
    if (document.getElementById(BANNER_ID)) return;

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'pims-sunset-notice';
    banner.setAttribute('role', 'status');

    const text = document.createElement('span');
    text.className = 'pims-sunset-text';
    text.textContent = NOTICE_TEXT;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pims-sunset-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    close.addEventListener('click', dismiss);

    banner.appendChild(text);
    banner.appendChild(close);
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('pims-sunset-notice-visible'));
  }

  function dismiss() {
    chrome.storage.local.get(STATE_KEY, (res) => {
      const state = (res && res[STATE_KEY]) || {};
      chrome.storage.local.set({ [STATE_KEY]: Object.assign({}, state, { dismissed: true }) });
    });
    removeNotice();
  }

  function removeNotice() {
    const banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    banner.classList.remove('pims-sunset-notice-visible');
    setTimeout(() => banner.remove(), 300);
  }

  // Dismissed in one tab → disappears from every other open PracticeHub tab.
  if (chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STATE_KEY] && changes[STATE_KEY].newValue &&
          changes[STATE_KEY].newValue.dismissed) {
        removeNotice();
      }
    });
  }
})();
