/**
 * Cohort key minting — Google Apps Script (bound to a Google Sheet).
 *
 * WHAT IT DOES
 *   Your assistant fills in Name / Email / Start Date for new students, then
 *   clicks  Cohort ▸ Mint keys for new rows.  For each row that doesn't have a
 *   key yet (and whose start date has arrived), it calls the LiteLLM proxy to
 *   mint a $10 / 60-day key and writes the key + expiry back into the sheet.
 *
 * ONE-TIME SETUP
 *   1. Open your Google Sheet ▸ Extensions ▸ Apps Script. Paste this file in.
 *   2. Project Settings ▸ Script Properties ▸ add:
 *        MASTER_KEY   = <your LITELLM_MASTER_KEY>   (from infra/litellm/.env)
 *        PROXY_URL    = https://parsity-litellm.fly.dev
 *        COHORT       = 2026-q3        (optional default; a "Cohort" column overrides it)
 *        BUDGET       = 10             (optional; dollars per student)
 *        DURATION     = 60d            (optional; key lifetime)
 *   3. Reload the sheet. A "Cohort" menu appears. First run asks you to authorize.
 *
 * SHEET LAYOUT (row 1 = headers, case-insensitive; order doesn't matter)
 *   Required : Email
 *   Optional : Name, Start Date, Cohort
 *   Filled by the script (leave blank): API Key, Expires, Status
 */

var OUTPUT_COLS = ['API Key', 'Expires', 'Status']; // auto-created if missing

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Cohort')
    .addItem('Mint keys for new rows', 'mintNewRows')
    .addItem('Email keys to unsent rows', 'emailKeys')
    .addItem('Update budget for selected rows…', 'updateBudgetForSelection')
    .addToUi();
}

/**
 * Raise/lower the $ cap on already-minted keys. Select the rows you want to
 * change (any cell in each row), run this, and enter the new dollar amount.
 * Existing spend is preserved — only the ceiling moves.
 */
function updateBudgetForSelection() {
  var props = PropertiesService.getScriptProperties();
  var masterKey = props.getProperty('MASTER_KEY');
  var proxyUrl = (props.getProperty('PROXY_URL') || 'https://parsity-litellm.fly.dev').replace(/\/+$/, '');
  var ui = SpreadsheetApp.getUi();
  if (!masterKey) { ui.alert('Missing MASTER_KEY in Script Properties.'); return; }

  var sheet = SpreadsheetApp.getActiveSheet();
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });
  var iKey = header.indexOf('api key');
  var iStatus = header.indexOf('status');
  if (iKey === -1) { ui.alert('No "API Key" column found.'); return; }

  var resp = ui.prompt('Update budget', 'New budget in dollars for the selected rows (e.g. 25):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) { return; }
  var newBudget = Number(resp.getResponseText());
  if (!(newBudget >= 0)) { ui.alert('Not a valid dollar amount.'); return; }

  var sel = sheet.getActiveRangeList().getRanges();
  var rows = {}; // dedupe row numbers across selected ranges
  sel.forEach(function (rng) {
    for (var r = rng.getRow(); r < rng.getRow() + rng.getNumRows(); r++) { if (r > 1) rows[r] = true; }
  });

  var updated = 0, skipped = 0, failed = 0;
  Object.keys(rows).forEach(function (rStr) {
    var r = Number(rStr);
    var key = String(sheet.getRange(r, iKey + 1).getValue() || '').trim();
    if (!key) { skipped++; return; }
    try {
      var res = UrlFetchApp.fetch(proxyUrl + '/key/update', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + masterKey },
        payload: JSON.stringify({ key: key, max_budget: newBudget }),
        muteHttpExceptions: true
      });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        if (iStatus !== -1) sheet.getRange(r, iStatus + 1).setValue('budget → $' + newBudget + ' (' + new Date().toISOString().slice(0, 10) + ')');
        updated++;
      } else {
        if (iStatus !== -1) sheet.getRange(r, iStatus + 1).setValue('ERROR: ' + res.getContentText().slice(0, 180));
        failed++;
      }
    } catch (e) {
      if (iStatus !== -1) sheet.getRange(r, iStatus + 1).setValue('ERROR: ' + e.message);
      failed++;
    }
  });

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Updated ' + updated + ', skipped ' + skipped + ', failed ' + failed + '.', 'Cohort', 6);
}

/**
 * Mail-merge: email each student their key. Sends from the Google account
 * running the script — so open the sheet as brian@parsity.io before using this,
 * NOT a personal gmail. Idempotent: sends only rows with a key that aren't yet
 * marked in the "Emailed" column, and stamps that column so re-runs don't
 * double-send. Prompts for confirmation (and shows the sending address) first.
 */
var EMAIL_SUBJECT = 'Your Parsity API key (for class)';

function emailBody_(key, proxyUrl) {
  return [
    "Hey — here's your private API key for class, courtesy of Parsity. It has $10 in credits, plenty to get started.",
    '',
    "Set BOTH of these when you use it. The key ONLY works through our proxy — with just the key on its own it won't:",
    '',
    '  OPENAI_API_KEY=' + key,
    '  OPENAI_BASE_URL=' + proxyUrl,
    '',
    "Then use it with the OpenAI SDK exactly as normal (any model, e.g. gpt-4o-mini). Nothing to do right now — you'll need it for class. If it doesn't work, just reply to brian@parsity.io.",
    '',
    '— Brian',
  ].join('\n');
}

function emailKeys() {
  var props = PropertiesService.getScriptProperties();
  var proxyUrl = (props.getProperty('PROXY_URL') || 'https://parsity-litellm.fly.dev').replace(/\/+$/, '');
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) { ui.alert('No data rows.'); return; }

  var header = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var col = function (name) { return header.indexOf(name.toLowerCase()); };

  // Ensure an "Emailed" column exists (for idempotency).
  if (col('emailed') === -1) {
    header.push('emailed');
    sheet.getRange(1, header.length).setValue('Emailed');
  }
  var iEmail = col('email'), iKey = col('api key'), iEmailed = col('emailed');
  if (iEmail === -1 || iKey === -1) { ui.alert('Need "Email" and "API Key" columns.'); return; }

  var targets = [];
  for (var r = 1; r < values.length; r++) {
    var email = String(values[r][iEmail] || '').trim();
    var key = String(values[r][iKey] || '').trim();
    var already = iEmailed < values[r].length ? String(values[r][iEmailed] || '').trim() : '';
    if (email && key && !already) targets.push({ row: r + 1, email: email, key: key });
  }
  if (!targets.length) { ui.alert('Nothing to send — every row with a key is already marked in "Emailed".'); return; }

  var from = Session.getActiveUser().getEmail();
  var ok = ui.alert(
    'Send keys',
    'Email the key to ' + targets.length + ' student(s), sending FROM: ' + from + ' ?\n\n' +
      '(If that is not brian@parsity.io, cancel and reopen the sheet as the Parsity account.)',
    ui.ButtonSet.OK_CANCEL
  );
  if (ok !== ui.Button.OK) return;

  var sent = 0, failed = 0;
  var today = new Date().toISOString().slice(0, 10);
  targets.forEach(function (t) {
    try {
      GmailApp.sendEmail(t.email, EMAIL_SUBJECT, emailBody_(t.key, proxyUrl));
      sheet.getRange(t.row, iEmailed + 1).setValue('sent ' + today);
      sent++;
    } catch (e) {
      sheet.getRange(t.row, iEmailed + 1).setValue('ERROR: ' + e.message);
      failed++;
    }
  });

  SpreadsheetApp.getActiveSpreadsheet().toast('Emailed ' + sent + ', failed ' + failed + '.', 'Cohort', 6);
}

function mintNewRows() {
  var props = PropertiesService.getScriptProperties();
  var masterKey = props.getProperty('MASTER_KEY');
  var proxyUrl = (props.getProperty('PROXY_URL') || 'https://parsity-litellm.fly.dev').replace(/\/+$/, '');
  var defaultCohort = props.getProperty('COHORT') || 'cohort';
  var budget = Number(props.getProperty('BUDGET') || 10);
  var duration = props.getProperty('DURATION') || '60d';

  if (!masterKey) {
    SpreadsheetApp.getUi().alert('Missing MASTER_KEY in Script Properties. See setup notes at the top of the script.');
    return;
  }

  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length < 2) { return; } // header only

  var header = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var col = function (name) { return header.indexOf(name.toLowerCase()); };

  // Ensure output columns exist; append any that are missing.
  OUTPUT_COLS.forEach(function (name) {
    if (col(name) === -1) {
      header.push(name.toLowerCase());
      sheet.getRange(1, header.length).setValue(name);
    }
  });

  var iEmail = col('email');
  if (iEmail === -1) {
    SpreadsheetApp.getUi().alert('No "Email" column found in row 1.');
    return;
  }
  var iName = col('name');
  var iStart = col('start date');
  var iCohort = col('cohort');
  var iKey = col('api key');
  var iExpires = col('expires');
  var iStatus = col('status');

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var minted = 0, skipped = 0, failed = 0;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var email = String(row[iEmail] || '').trim();
    if (!email) { continue; }
    if (iKey !== -1 && String(row[iKey] || '').trim()) { skipped++; continue; } // already has a key

    // Respect a future start date, if provided.
    if (iStart !== -1 && row[iStart]) {
      var start = new Date(row[iStart]);
      if (!isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        if (start > today) {
          if (iStatus !== -1) sheet.getRange(r + 1, iStatus + 1).setValue('waiting until ' + row[iStart]);
          skipped++;
          continue;
        }
      }
    }

    var cohort = (iCohort !== -1 && String(row[iCohort] || '').trim()) || defaultCohort;
    var name = iName !== -1 ? String(row[iName] || '').trim() : '';

    var payload = {
      key_alias: cohort + '-' + email,
      max_budget: budget,
      duration: duration,
      metadata: { student: name, email: email, cohort: cohort, start_date: iStart !== -1 ? String(row[iStart] || '') : '' }
    };

    try {
      var resp = UrlFetchApp.fetch(proxyUrl + '/key/generate', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + masterKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      var code = resp.getResponseCode();
      var body = JSON.parse(resp.getContentText());
      if (code >= 200 && code < 300 && body.key) {
        if (iKey !== -1) sheet.getRange(r + 1, iKey + 1).setValue(body.key);
        if (iExpires !== -1) sheet.getRange(r + 1, iExpires + 1).setValue(body.expires || '');
        if (iStatus !== -1) sheet.getRange(r + 1, iStatus + 1).setValue('minted ' + new Date().toISOString().slice(0, 10));
        minted++;
      } else {
        var msg = (body.error && (body.error.message || body.error)) || resp.getContentText();
        if (iStatus !== -1) sheet.getRange(r + 1, iStatus + 1).setValue('ERROR: ' + String(msg).slice(0, 180));
        failed++;
      }
    } catch (e) {
      if (iStatus !== -1) sheet.getRange(r + 1, iStatus + 1).setValue('ERROR: ' + e.message);
      failed++;
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Minted ' + minted + ', skipped ' + skipped + ', failed ' + failed + '.', 'Cohort', 6);
}
