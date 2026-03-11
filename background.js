/**
 * PracticeHub → PIMS Copier — Background Service Worker (v1.3)
 */

const DEFAULT_SETTINGS = {
  enabledFields: [
    'rxId', 'approvalStatus', 'dateWritten', 'dateCreated',
    'approvedDeclinedBy', 'prescribingVet', 'reasonToDecline', 'internalNotes',
    'rxName', 'expiration', 'qtyPerFill', 'qtyRemaining',
    'refillsRemaining', 'instructions', 'compoundReasons'
  ],
  separator: 'newline',
  includeLabels: true,
  showNotification: true
};

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({ pimsSettings: DEFAULT_SETTINGS }, () => {
      console.log('[PIMS Copier] v1.3 defaults initialized.');
    });
  }

  if (details.reason === 'update') {
    // Reset settings on update to pick up new field definitions
    chrome.storage.sync.set({ pimsSettings: DEFAULT_SETTINGS }, () => {
      console.log(`[PIMS Copier] Updated to v${chrome.runtime.getManifest().version}, settings reset to defaults.`);
    });
  }
});
