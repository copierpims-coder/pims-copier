/**
 * PracticeHub → PIMS Copier — Popup Settings UI (v1.3)
 */

(function () {
  'use strict';

  const FIELD_DEFINITIONS = [
    { id: 'rxId',              label: 'Rx ID (DG/DT#)',           defaultEnabled: true,  group: 'Header' },
    { id: 'approvalStatus',    label: 'Status',                   defaultEnabled: true,  group: 'Header' },
    { id: 'dateWritten',       label: 'Date Written',             defaultEnabled: true,  group: 'Header' },
    { id: 'dateCreated',       label: 'Created On',               defaultEnabled: true,  group: 'Header' },
    { id: 'approvedDeclinedBy',label: 'Approved/Declined By',     defaultEnabled: true,  group: 'Header' },
    { id: 'approverEmail',     label: 'Email',                    defaultEnabled: false, group: 'Header' },
    { id: 'chewyOrderNumber',  label: 'Chewy Order #',            defaultEnabled: false, group: 'Header' },
    { id: 'prescribingVet',    label: 'Prescribing Vet',          defaultEnabled: true,  group: 'Clinic' },
    { id: 'reasonToDecline',   label: 'Reason to Decline',        defaultEnabled: true,  group: 'Clinic' },
    { id: 'internalNotes',     label: 'Internal Notes',           defaultEnabled: true,  group: 'Clinic' },
    { id: 'rxName',            label: 'Rx (Drug/Product)',        defaultEnabled: true,  group: 'Rx Details' },
    { id: 'expiration',        label: 'Expiration',               defaultEnabled: true,  group: 'Rx Details' },
    { id: 'qtyPerFill',        label: 'Qty per Fill',             defaultEnabled: true,  group: 'Rx Details' },
    { id: 'qtyRemaining',      label: 'Qty Remaining',            defaultEnabled: true,  group: 'Rx Details' },
    { id: 'refillsRemaining',  label: 'Refills Remaining',        defaultEnabled: true,  group: 'Rx Details' },
    { id: 'lastDelivered',     label: 'Last Delivered',           defaultEnabled: false, group: 'Rx Details' },
    { id: 'instructions',      label: 'Instructions',             defaultEnabled: true,  group: 'Usage' },
    { id: 'pharmacistNotes',   label: 'Notes to Pharmacist',      defaultEnabled: false, group: 'Usage' },
    { id: 'compoundReasons',   label: 'Compound Reasons',         defaultEnabled: true,  group: 'Compound' },
    { id: 'submittedBy',       label: 'Submitted By',             defaultEnabled: false, group: 'Other' },
    { id: 'patientName',       label: 'Patient',                  defaultEnabled: false, group: 'Other' },
    { id: 'clientName',        label: 'Client',                   defaultEnabled: false, group: 'Other' }
  ];

  const DEFAULT_SETTINGS = {
    enabledFields: FIELD_DEFINITIONS.filter(f => f.defaultEnabled).map(f => f.id),
    separator: 'newline',
    includeLabels: true,
    showNotification: true
  };

  const SAMPLE_DATA = {
    rxId: 'DG125871493',
    approvalStatus: 'Approved',
    dateWritten: '03/10/2026 6:30PM',
    dateCreated: '03/10/2026 6:30PM',
    approvedDeclinedBy: 'Jenny Krista',
    approverEmail: 'jennykkrista@gmail.com',
    chewyOrderNumber: '5115246016',
    prescribingVet: 'Shawn Budge',
    reasonToDecline: 'Wrong Product (Item or Dosage)',
    internalNotes: 'Needs 22-44lbs and has an existing Rx with 12 doses still available',
    rxName: 'Gabapentin Compounded Chicken Oral Oil Suspension, 100 mg/ml, 30 mL',
    expiration: '3/09/2027',
    qtyPerFill: '30 ml',
    qtyRemaining: '30 of 60 ml',
    refillsRemaining: '1 of 1',
    lastDelivered: '—',
    instructions: 'Give 0.3ml by mouth every 12 hours for pain control.',
    pharmacistNotes: 'N/A',
    compoundReasons: 'Flavor — The pet will not take the approved product; Strength — Dosage cannot be achieved',
    submittedBy: 'HomeVetsMD',
    patientName: 'Meatloaf (Cat)',
    clientName: 'Julia Goffredi'
  };

  const fieldListEl = document.getElementById('fieldList');
  const separatorEl = document.getElementById('separator');
  const includeLabelsEl = document.getElementById('includeLabels');
  const showNotificationEl = document.getElementById('showNotification');
  const previewEl = document.getElementById('preview');
  const saveBtnEl = document.getElementById('saveBtn');
  const statusDotEl = document.getElementById('statusDot');
  const statusTextEl = document.getElementById('statusText');

  function buildFieldList(enabledFields) {
    fieldListEl.innerHTML = '';
    let currentGroup = '';

    FIELD_DEFINITIONS.forEach(field => {
      // Add group header
      if (field.group && field.group !== currentGroup) {
        currentGroup = field.group;
        const groupHeader = document.createElement('div');
        groupHeader.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;margin:8px 0 2px 4px;';
        groupHeader.textContent = currentGroup;
        fieldListEl.appendChild(groupHeader);
      }

      const item = document.createElement('div');
      item.className = 'field-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `field-${field.id}`;
      checkbox.dataset.fieldId = field.id;
      checkbox.checked = enabledFields.includes(field.id);
      checkbox.addEventListener('change', updatePreview);
      const label = document.createElement('label');
      label.htmlFor = `field-${field.id}`;
      label.textContent = field.label;
      const tag = document.createElement('span');
      tag.className = 'field-tag';
      tag.textContent = field.defaultEnabled ? '' : 'optional';
      item.appendChild(checkbox);
      item.appendChild(label);
      item.appendChild(tag);
      fieldListEl.appendChild(item);
    });
  }

  function getUISettings() {
    const checkboxes = fieldListEl.querySelectorAll('input[type="checkbox"]');
    const enabledFields = [];
    checkboxes.forEach(cb => { if (cb.checked) enabledFields.push(cb.dataset.fieldId); });
    return {
      enabledFields,
      separator: separatorEl.value,
      includeLabels: includeLabelsEl.checked,
      showNotification: showNotificationEl.checked
    };
  }

  function updatePreview() {
    const settings = getUISettings();
    if (settings.enabledFields.length === 0) {
      previewEl.innerHTML = '<span class="preview-empty">No fields selected</span>';
      return;
    }
    const separatorMap = { newline: '\n', tab: '\t', comma: ', ', pipe: ' | ' };
    const sep = separatorMap[settings.separator] || '\n';
    const lines = settings.enabledFields.map(id => {
      const field = FIELD_DEFINITIONS.find(f => f.id === id);
      const value = SAMPLE_DATA[id] || '—';
      return settings.includeLabels ? `${field.label}: ${value}` : value;
    });
    previewEl.textContent = lines.join(sep);
  }

  function saveSettings() {
    const settings = getUISettings();
    chrome.storage.sync.set({ pimsSettings: settings }, () => {
      saveBtnEl.textContent = 'Saved!';
      saveBtnEl.classList.add('saved');
      setTimeout(() => {
        saveBtnEl.textContent = 'Save Settings';
        saveBtnEl.classList.remove('saved');
      }, 1500);
    });
  }

  function setAllCheckboxes(state) {
    fieldListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = state; });
    updatePreview();
  }

  function setRecommended() {
    fieldListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const field = FIELD_DEFINITIONS.find(f => f.id === cb.dataset.fieldId);
      cb.checked = field ? field.defaultEnabled : false;
    });
    updatePreview();
  }

  function checkActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const url = tabs[0].url.toLowerCase();
        if (url.includes('chewyhealth.com') || url.includes('practicehub')) {
          statusDotEl.className = 'dot dot-active';
          statusTextEl.textContent = 'Active on PracticeHub';
        } else {
          statusDotEl.className = 'dot dot-inactive';
          statusTextEl.textContent = 'Not on PracticeHub';
        }
      }
    });
  }

  separatorEl.addEventListener('change', updatePreview);
  includeLabelsEl.addEventListener('change', updatePreview);
  showNotificationEl.addEventListener('change', updatePreview);
  saveBtnEl.addEventListener('click', saveSettings);
  document.getElementById('selectRecommended').addEventListener('click', setRecommended);
  document.getElementById('selectAll').addEventListener('click', () => setAllCheckboxes(true));
  document.getElementById('selectNone').addEventListener('click', () => setAllCheckboxes(false));

  chrome.storage.sync.get('pimsSettings', (result) => {
    const settings = result.pimsSettings || DEFAULT_SETTINGS;

    // Validate field IDs (handle version upgrades)
    const validIds = new Set(FIELD_DEFINITIONS.map(f => f.id));
    let enabledFields = (settings.enabledFields || []).filter(id => validIds.has(id));
    if (enabledFields.length === 0) enabledFields = DEFAULT_SETTINGS.enabledFields;

    buildFieldList(enabledFields);
    separatorEl.value = settings.separator || 'newline';
    includeLabelsEl.checked = settings.includeLabels !== false;
    showNotificationEl.checked = settings.showNotification !== false;
    updatePreview();
    checkActiveTab();
  });

})();
