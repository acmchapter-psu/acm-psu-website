/**
 * Canonical public event intake. Load alongside Code.gs; no other doPost/doGet.
 *
 * Dynamic: any event tab in the registration workbook accepts sign-ups without
 * code changes. The form posts `event=<tab name>` and one field per column,
 * named either like the header ("Full Name") or in camelCase ("fullName").
 * Columns are read from the tab's header row at submit time.
 *
 * Canonical club tabs (People, Members, ...) can never be written from here.
 */
var REGISTRATION_SPREADSHEET_ID = '1wXP3WvqcjnDEOe_sDSGXR-Z6HKvjnufarA4r-CovVEU';
var REGISTRATION_VERSION = '2026-09-29.4';
var REGISTRATION_SOURCE = 'acm-event-registration';

/**
 * Event keys whose tab has a different name. New events need no entry here:
 * `event=webforge26` finds the "WebForge26" tab on its own (case, spaces and
 * punctuation are ignored when matching).
 */
var REGISTRATION_TAB_ALIASES = { jam26: 'WebForge26' };

/**
 * Tabs the public form may never write to. Code.gs's CANONICAL_SHEETS are
 * added automatically, so new canonical tabs are protected too.
 */
var REGISTRATION_PROTECTED_TABS = [
  'People', 'Membership Applications', 'Members', 'Club Positions',
  'Opportunity Positions', 'Position Applications', 'Event Participation',
  'Contributions', 'Inquiries', 'University Export Log', 'Messages'
];

/** Form keys that carry request metadata, never sheet data. */
var REGISTRATION_RESERVED_FIELDS = ['event', 'requestId', 'website', 'type'];

/**
 * Optional stricter rules for specific events. Events not listed here use the
 * dynamic rules in handleDynamicRegistration_.
 */
var REGISTRATION_EVENTS = {
  jam26: {
    fields: {
      fullName: 'Full Name',
      universityId: 'University ID',
      universityEmail: 'University Email',
      phoneNumber: 'Phone Number',
      major: 'Major',
      teamName: 'Team Name',
      teamMembers: 'Team Members'
    },
    required: ['fullName', 'universityId', 'universityEmail', 'phoneNumber', 'major', 'teamName'],
    emailFields: ['universityEmail'],
    // Comma-separated email lists, with the maximum number of entries.
    emailListFields: { teamMembers: 10 },
    optionalGroup: [],
    enums: {},
    limits: {
      fullName: 120, universityId: 40, universityEmail: 254, phoneNumber: 40,
      major: 120, teamName: 120, teamMembers: 1500
    },
    uniqueChecks: [
      { fields: ['universityEmail'], message: 'this participant is already registered' },
      { fields: ['universityId'], message: 'this participant is already registered' }
    ],
    rateFields: ['universityEmail', 'universityId']
  },

  ctf30: {
    fields: {
      teamName: 'Team Name',
      captainName: 'Captain Name',
      captainId: 'Captain University ID',
      captainEmail: 'Captain University Email',
      captainPhone: 'Captain Phone Number',
      captainMajor: 'Captain Major',
      member2Name: 'Member 2 Name',
      member2Id: 'Member 2 University ID',
      member2Email: 'Member 2 University Email',
      member2Major: 'Member 2 Major',
      member3Name: 'Member 3 Name',
      member3Id: 'Member 3 University ID',
      member3Email: 'Member 3 University Email',
      member3Major: 'Member 3 Major',
      experience: 'Experience Level'
    },
    required: [
      'teamName', 'experience',
      'captainName', 'captainId', 'captainEmail', 'captainPhone', 'captainMajor',
      'member2Name', 'member2Id', 'member2Email', 'member2Major'
    ],
    emailFields: ['captainEmail', 'member2Email'],
    emailListFields: {},
    // All four or none, so a half-filled third member never lands.
    optionalGroup: ['member3Name', 'member3Id', 'member3Email', 'member3Major'],
    optionalGroupEmails: ['member3Email'],
    enums: { experience: ['Beginner', 'Intermediate', 'Advanced'] },
    limits: {
      teamName: 120, experience: 40,
      captainName: 120, captainId: 40, captainEmail: 254, captainPhone: 40, captainMajor: 120,
      member2Name: 120, member2Id: 40, member2Email: 254, member2Major: 120,
      member3Name: 120, member3Id: 40, member3Email: 254, member3Major: 120
    },
    uniqueChecks: [
      {
        fields: ['captainEmail', 'member2Email', 'member3Email'],
        message: 'one of these participants is already registered'
      },
      {
        fields: ['captainId', 'member2Id', 'member3Id'],
        message: 'one of these participants is already registered'
      },
      { fields: ['teamName'], message: 'that team name is already taken' }
    ],
    // Nobody may occupy two slots on the same team.
    distinctWithinRow: [
      {
        fields: ['captainEmail', 'member2Email', 'member3Email'],
        message: 'each member needs a different university email'
      },
      {
        fields: ['captainId', 'member2Id', 'member3Id'],
        message: 'each member needs a different university ID'
      }
    ],
    rateFields: ['captainEmail', 'teamName']
  }
};

/** Same window both front-ends wait on before giving up, less a safety margin. */
var REGISTRATION_LOCK_MS = 15000;
/** Seconds an identical submitter is asked to wait before retrying. */
var REGISTRATION_RATE_SECONDS = 300;
var DEFAULT_FIELD_LIMIT = 1500;
var REGISTRATION_EVENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,79}$/;


/**
 * Public registration intake. Append-only, and never able to read back or
 * modify existing rows.
 */
function doPost(e) {
  var form = (e && e.parameter) || {};
  var event = String(form.event || '').trim();
  var requestId = String(form.requestId || '');
  var reply = function (message) { return registrationReply(event, message, requestId); };
  if (!REGISTRATION_EVENT_PATTERN.test(event)) return reply('Error: unsupported event');
  if (requestId && !/^[a-f0-9]{32}$/.test(requestId)) return registrationReply(event, 'Error: invalid request identifier', '');
  if (e && e.postData && e.postData.length > 20000) return reply('Error: submission is too large');
  if (String(form.website || '').trim()) return reply('Error: registration could not be accepted');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(REGISTRATION_LOCK_MS);
    // Apps Script does not expose the client IP. This is best-effort abuse
    // protection, not a substitute for a dedicated anti-bot service.
    var cache = CacheService.getScriptCache();
    var bucket = 'event-burst:' + Math.floor(Date.now() / 60000);
    var count = Number(cache.get(bucket) || 0);
    if (count >= 240) return reply('Error: registration is busy. Please try again in a minute');
    cache.put(bucket, String(count + 1), 60);

    // Resolve the worksheet from the workbook itself, never from a sheet ID
    // or range supplied by the caller.
    var sheet = registrationSheet_(event);
    if (!sheet) {
      console.error('NO EVENT TAB for event "' + event + '"');
      return reply('Error: registration for this event is not open. Please contact the organizers.');
    }
    var headers = registrationHeaders_(sheet);
    var config = Object.prototype.hasOwnProperty.call(REGISTRATION_EVENTS, event) ? REGISTRATION_EVENTS[event] : null;
    return config
      ? handleConfiguredRegistration_(event, config, sheet, headers, form)
      : handleDynamicRegistration_(event, sheet, headers, form);
  } catch (err) {
    console.error('Event registration failed: ' + (err && err.message ? err.message : err));
    return reply('Error: registration could not be confirmed. Contact the organizers before retrying.');
  } finally {
    try { lock.releaseLock(); } catch (releaseError) { }
  }
}


/** Events listed in REGISTRATION_EVENTS: their own required fields and rules. */
function handleConfiguredRegistration_(event, config, sheet, headers, form) {
  var reply = function (message) { return registrationReply(event, message, String(form.requestId || '')); };
  var value = function (field) { return String(form[field] === undefined ? '' : form[field]).trim(); };
  var i;

  for (i = 0; i < config.required.length; i += 1) {
    if (!value(config.required[i])) return reply('Error: missing ' + config.required[i]);
  }

  // Optional block is all-or-nothing.
  var group = config.optionalGroup || [];
  var filled = group.filter(function (field) { return value(field); });
  var hasGroup = group.length > 0 && filled.length === group.length;
  if (filled.length && !hasGroup) {
    return reply('Error: complete every optional member field or leave them all blank');
  }

  var fieldNames = Object.keys(config.fields);
  for (i = 0; i < fieldNames.length; i += 1) {
    var limit = config.limits[fieldNames[i]] || DEFAULT_FIELD_LIMIT;
    if (value(fieldNames[i]).length > limit) return reply('Error: ' + fieldNames[i] + ' is too long');
  }

  var enumFields = Object.keys(config.enums || {});
  for (i = 0; i < enumFields.length; i += 1) {
    if (config.enums[enumFields[i]].indexOf(value(enumFields[i])) === -1) {
      return reply('Error: invalid ' + enumFields[i]);
    }
  }

  var emailFields = (config.emailFields || []).slice();
  if (hasGroup) emailFields = emailFields.concat(config.optionalGroupEmails || []);
  for (i = 0; i < emailFields.length; i += 1) {
    if (!isRegistrationEmail(value(emailFields[i]))) return reply('Error: invalid ' + emailFields[i]);
  }

  var listFields = Object.keys(config.emailListFields || {});
  for (i = 0; i < listFields.length; i += 1) {
    if (!value(listFields[i])) continue;
    var entries = value(listFields[i]).split(',').map(function (email) { return email.trim(); });
    var max = config.emailListFields[listFields[i]];
    if (entries.length > max || entries.some(function (email) { return !isRegistrationEmail(email) || email.length > 254; })) {
      return reply('Error: enter up to ' + max + ' valid emails separated by commas');
    }
  }

  var withinRow = config.distinctWithinRow || [];
  for (i = 0; i < withinRow.length; i += 1) {
    var seen = withinRow[i].fields
      .map(function (f) { return value(f).toLowerCase(); })
      .filter(function (v) { return v; });
    if (hasArrayDuplicate(seen)) return reply('Error: ' + withinRow[i].message);
  }

  // Refuse rather than write a row with silently dropped columns.
  var missing = fieldNames
    .map(function (f) { return config.fields[f]; })
    .filter(function (h) { return registrationColumn_(headers, h) === -1; });
  if (missing.length) {
    console.error('MISSING COLUMNS in "' + sheet.getName() + '": ' + missing.join(', '));
    return reply('Error: registration storage is not ready. Please contact the organizers.');
  }

  var values = {};
  fieldNames.forEach(function (f) { values[config.fields[f]] = value(f); });

  var uniqueChecks = (config.uniqueChecks || []).map(function (check) {
    return {
      headers: check.fields.map(function (f) { return config.fields[f]; }),
      values: check.fields.map(value),
      message: check.message
    };
  });

  var identity = (config.rateFields || []).map(function (f) { return value(f).toLowerCase(); }).join('|');
  return writeRegistration_(event, sheet, headers, values, uniqueChecks, identity, String(form.requestId || ''), reply);
}


/**
 * Any other event: the tab's header row is the form definition. Submitted
 * fields are matched to columns by name; unknown fields are ignored.
 */
function handleDynamicRegistration_(event, sheet, headers, form) {
  var reply = function (message) { return registrationReply(event, message, String(form.requestId || '')); };

  var columns = {};
  headers.forEach(function (header) {
    var key = registrationKey_(header);
    if (key && key !== 'timestamp' && !columns[key]) columns[key] = header;
  });
  if (!Object.keys(columns).length) {
    console.error('EMPTY HEADER ROW in "' + sheet.getName() + '"');
    return reply('Error: registration storage is not ready. Please contact the organizers.');
  }

  var values = {};
  var filledCount = 0;
  var reserved = REGISTRATION_RESERVED_FIELDS.map(registrationKey_);
  var names = Object.keys(form);
  for (var i = 0; i < names.length; i += 1) {
    var key = registrationKey_(names[i]);
    if (reserved.indexOf(key) !== -1 || !columns[key]) continue;
    var text = String(form[names[i]] === undefined ? '' : form[names[i]]).trim();
    if (text.length > DEFAULT_FIELD_LIMIT) return reply('Error: ' + columns[key] + ' is too long');
    values[columns[key]] = text;
    if (text) filledCount += 1;
  }
  if (!filledCount) return reply('Error: the form did not send any fields this event collects');

  // Email columns must hold an email; university/student ID and email columns
  // may not repeat an existing registration for this event.
  var emailHeaders = [];
  var idHeaders = [];
  Object.keys(values).forEach(function (header) {
    var key = registrationKey_(header);
    if (key.indexOf('email') !== -1) emailHeaders.push(header);
    if (/(university|student)id$/.test(key)) idHeaders.push(header);
  });
  for (var e = 0; e < emailHeaders.length; e += 1) {
    var email = values[emailHeaders[e]];
    if (email && !isRegistrationEmail(email)) return reply('Error: invalid ' + emailHeaders[e]);
  }

  var emailValues = emailHeaders.map(function (h) { return values[h].toLowerCase(); }).filter(Boolean);
  if (hasArrayDuplicate(emailValues)) return reply('Error: each person needs a different email');

  var uniqueChecks = [
    {
      headers: emailHeaders,
      values: emailHeaders.map(function (h) { return values[h]; }),
      message: 'this email is already registered for this event'
    },
    {
      headers: idHeaders,
      values: idHeaders.map(function (h) { return values[h]; }),
      message: 'this ID is already registered for this event'
    }
  ];

  var identity = emailValues.length
    ? emailValues.join('|')
    : Object.keys(values).sort().map(function (h) { return values[h].toLowerCase(); }).join('|');
  return writeRegistration_(event, sheet, headers, values, uniqueChecks, identity, String(form.requestId || ''), reply);
}


/** Shared tail: duplicate check, rate limit, then one appended row. */
function writeRegistration_(event, sheet, headers, values, uniqueChecks, identity, requestId, reply) {
  var duplicate = findExistingRegistration(sheet, headers, uniqueChecks);
  if (duplicate) return reply('Error: ' + duplicate);

  // Rate limit last, so a rejected attempt never locks out an immediate retry.
  var rateScope = registrationKey_(sheet.getName());
  if (identity && !allowRegistrationRequest(rateScope, identity, REGISTRATION_RATE_SECONDS)) {
    return reply('Error: please wait before submitting again');
  }

  var row = new Array(headers.length);
  for (var i = 0; i < row.length; i += 1) row[i] = '';

  Object.keys(values).forEach(function (header) {
    var col = registrationColumn_(headers, header);
    if (col !== -1) row[col] = safeRegistrationCell(values[header]);
  });

  var tsCol = registrationColumn_(headers, 'Timestamp');
  if (tsCol !== -1) row[tsCol] = new Date();

  // appendRow only ever adds a new last row. No existing registration is read
  // back to the caller, cleared, or overwritten anywhere in this handler.
  try {
    sheet.appendRow(row);
    SpreadsheetApp.flush();
  } catch (err) {
    // Nothing was saved, so let the person retry straight away.
    if (identity) releaseRegistrationRequest(rateScope, identity);
    console.error('WRITE FAILED in "' + sheet.getName() + '": ' + (err && err.message ? err.message : err));
    return reply('Error: registration could not be saved. Please contact the organizers.');
  }

  // The row is saved. Copying it to the platform's records backup happens
  // after, so a failed copy can never turn a saved registration into an error
  // the participant sees; the admin import recovers anything it missed.
  try {
    mirrorRegistrationToPlatform_(event, sheet.getName(), headers, row, requestId);
  } catch (mirrorError) {
    console.error('MIRROR FAILED for "' + sheet.getName() + '": ' + (mirrorError && mirrorError.message ? mirrorError.message : mirrorError));
  }
  return reply('OK');
}


/**
 * Best-effort second copy into the ACM PSU platform (Admin > Records Backup).
 *
 * Configured through Script Properties rather than constants, because the
 * token is a credential and this file is public:
 *
 *   PLATFORM_INTAKE_URL     the event-registration-intake Edge Function URL
 *   PLATFORM_INTAKE_TOKEN   the value of its EVENT_REGISTRATION_TOKEN secret
 *
 * With either missing the copy is skipped, so registration keeps working
 * before the platform side is configured. The platform finds the event by its
 * key or by its worksheet name, so events whose form posts the tab name work
 * too.
 */
function mirrorRegistrationToPlatform_(event, sheetName, headers, row, requestId) {
  var properties = PropertiesService.getScriptProperties();
  var url = String(properties.getProperty('PLATFORM_INTAKE_URL') || '').trim();
  var token = String(properties.getProperty('PLATFORM_INTAKE_TOKEN') || '').trim();
  if (!url || !token) {
    console.error('MIRROR SKIPPED: set PLATFORM_INTAKE_URL and PLATFORM_INTAKE_TOKEN in Script Properties');
    return;
  }

  var fields = {};
  for (var i = 0; i < headers.length; i += 1) {
    var value = row[i];
    fields[String(headers[i])] = value instanceof Date
      ? value.toISOString()
      : String(value === undefined || value === null ? '' : value);
  }

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-registration-token': token },
    // A non-2xx reply must not throw: the registration is already recorded.
    muteHttpExceptions: true,
    payload: JSON.stringify({
      event: String(event),
      sheet: String(sheetName),
      requestId: String(requestId || ''),
      fields: fields
    })
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    console.error('MIRROR REJECTED (' + status + ') for "' + sheetName + '": ' + response.getContentText());
  }
}


/**
 * Run from the editor to send one clearly-marked test call to the platform
 * and log the reply. It posts an unknown event, so nothing is stored: a
 * 400 "Unknown event" means the URL and token are right; 401 means the token
 * does not match EVENT_REGISTRATION_TOKEN.
 */
function debugPlatformMirror() {
  var properties = PropertiesService.getScriptProperties();
  var url = String(properties.getProperty('PLATFORM_INTAKE_URL') || '').trim();
  var token = String(properties.getProperty('PLATFORM_INTAKE_TOKEN') || '').trim();
  if (!url || !token) {
    console.log('Missing Script Properties: ' + (!url ? 'PLATFORM_INTAKE_URL ' : '') + (!token ? 'PLATFORM_INTAKE_TOKEN' : ''));
    return;
  }
  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-registration-token': token },
    muteHttpExceptions: true,
    payload: JSON.stringify({ event: '__connection_check__', fields: {} })
  });
  console.log(response.getResponseCode() + ' ' + response.getContentText());
}


/**
 * Finds the event's tab by name (ignoring case, spaces and punctuation), after
 * applying REGISTRATION_TAB_ALIASES. Protected club tabs are never returned.
 */
function registrationSheet_(event) {
  var alias = Object.prototype.hasOwnProperty.call(REGISTRATION_TAB_ALIASES, event)
    ? REGISTRATION_TAB_ALIASES[event] : event;
  var wanted = registrationKey_(alias);
  if (!wanted) return null;

  var sheets = SpreadsheetApp.openById(REGISTRATION_SPREADSHEET_ID).getSheets();
  for (var i = 0; i < sheets.length; i += 1) {
    var name = sheets[i].getName();
    if (registrationKey_(name) === wanted) return isProtectedRegistrationTab_(name) ? null : sheets[i];
  }
  return null;
}


function isProtectedRegistrationTab_(name) {
  var names = REGISTRATION_PROTECTED_TABS.slice();
  if (typeof CANONICAL_SHEETS === 'object' && CANONICAL_SHEETS) names = names.concat(Object.keys(CANONICAL_SHEETS));
  var key = registrationKey_(name);
  return names.some(function (n) { return registrationKey_(n) === key; });
}


function registrationHeaders_(sheet) {
  var width = sheet.getLastColumn();
  if (width < 1) return [];
  return sheet.getRange(1, 1, 1, width).getDisplayValues()[0]
    .map(function (h) { return String(h).trim(); });
}


/** Column index of a header, matched the same loose way as tab names. */
function registrationColumn_(headers, header) {
  var key = registrationKey_(header);
  for (var i = 0; i < headers.length; i += 1) {
    if (registrationKey_(headers[i]) === key) return i;
  }
  return -1;
}


/** "Full Name", "fullName" and "full_name" all become "fullname". */
function registrationKey_(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}


/**
 * One read of the data range, then every uniqueness rule is answered from it.
 * Each check lists columns and submitted values; any submitted value found in
 * any of those columns is a duplicate. Nothing read here is returned.
 */
function findExistingRegistration(sheet, headers, checks) {
  if (!checks.length || sheet.getLastRow() < 2) return '';

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues();

  for (var c = 0; c < checks.length; c += 1) {
    var check = checks[c];
    var wanted = Object.create(null);
    var any = false;
    check.values.forEach(function (v) {
      v = String(v || '').trim().toLowerCase();
      if (v) { wanted[v] = true; any = true; }
    });
    if (!any) continue;

    for (var h = 0; h < check.headers.length; h += 1) {
      var col = registrationColumn_(headers, check.headers[h]);
      if (col === -1) continue;
      for (var r = 0; r < rows.length; r += 1) {
        var cell = String(rows[r][col] === undefined ? '' : rows[r][col]).trim().toLowerCase();
        if (cell && wanted[cell]) return check.message;
      }
    }
  }
  return '';
}


function hasArrayDuplicate(values) {
  for (var i = 0; i < values.length; i += 1) {
    if (values.indexOf(values[i]) !== i) return true;
  }
  return false;
}


function isRegistrationEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}


/**
 * Neutralises spreadsheet formula injection. A leading =, +, - or @ makes
 * Sheets evaluate the cell, so the value is stored as literal text instead.
 */
function safeRegistrationCell(value) {
  var text = String(value || '').trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}


/**
 * Per-identity throttle held in the script cache. Keys are hashed so no email
 * address or university ID is stored in the cache in readable form.
 */
function allowRegistrationRequest(scope, identity, seconds) {
  var key = registrationRateKey_(scope, identity);
  var cache = CacheService.getScriptCache();
  if (cache.get(key)) return false;
  cache.put(key, '1', seconds);
  return true;
}


function releaseRegistrationRequest(scope, identity) {
  CacheService.getScriptCache().remove(registrationRateKey_(scope, identity));
}


function registrationRateKey_(scope, identity) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, scope + '|' + identity);
  return Utilities.base64EncodeWebSafe(digest).slice(0, 80);
}


/**
 * The reply both front-ends listen for. `source` must match the tag that the
 * requesting form filters on, and `event` must echo the event key the form
 * sent, or that form ignores this message and times out.
 */
function registrationReply(event, message, requestId) {
  var payload = JSON.stringify({
    source: REGISTRATION_SOURCE, event: String(event),
    requestId: String(requestId || ''), message: String(message), version: REGISTRATION_VERSION
  })
    .replace(/</g, '\\u003c');
  var relay = 'var m=' + payload + ';' +
    'try{parent.postMessage(m,"*")}catch(e){}' +
    'try{if(top!==parent)top.postMessage(m,"*")}catch(e){}';
  return HtmlService.createHtmlOutput('<p>' + escapeRegistrationHtml(String(message)) + '</p><script>' + relay + '<\/script>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function escapeRegistrationHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


/**
 * GET is not a registration path and reports nothing about the workbook.
 */
function doGet() {
  return json_({ status: 'ok', message: 'ACM PSU event registration endpoint is live.', version: REGISTRATION_VERSION });
}


/** JSON response helper. */
function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Run from the editor (select it next to Debug, then Run) to see which tabs
 * accept registrations, which event key reaches each, and their columns.
 */
function debugRegistrationStorage() {
  var ss = SpreadsheetApp.openById(REGISTRATION_SPREADSHEET_ID);
  console.log('Workbook: ' + ss.getName() + ' | script version ' + REGISTRATION_VERSION);

  ss.getSheets().forEach(function (sheet) {
    var name = sheet.getName();
    if (isProtectedRegistrationTab_(name)) {
      console.log('[protected] ' + name);
      return;
    }
    var aliases = Object.keys(REGISTRATION_TAB_ALIASES).filter(function (k) {
      return registrationKey_(REGISTRATION_TAB_ALIASES[k]) === registrationKey_(name);
    });
    console.log('[OPEN] ' + name + ' | event=' + [registrationKey_(name)].concat(aliases).join(' or event=') +
      ' | columns: ' + JSON.stringify(registrationHeaders_(sheet)));
  });

  Object.keys(REGISTRATION_EVENTS).forEach(function (event) {
    var sheet = registrationSheet_(event);
    console.log('Configured event ' + event + ' -> ' + (sheet ? sheet.getName() : 'NO TAB FOUND'));
  });
}
