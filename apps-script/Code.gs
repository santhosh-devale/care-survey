/**
 * Receives one survey call from the CARE Forms Survey app and appends it
 * as a row in this spreadsheet's "Responses" tab.
 *
 * Setup: see README.md ("Connect a Google Sheet").
 */
const SHEET_NAME = 'Responses'

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(15000)
  try {
    const data = JSON.parse(e.postData.contents)
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME)

    // First call writes the header row from the keys the app sends.
    if (sheet.getLastRow() === 0) {
      const keys = Object.keys(data)
      sheet.appendRow(keys)
      sheet.setFrozenRows(1)
      sheet.getRange(1, 1, 1, keys.length).setFontWeight('bold')
    }

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]

    // Skip a call that was already sent (the app can resend from History).
    const idCol = header.indexOf('Call ID') + 1
    if (idCol > 0 && sheet.getLastRow() > 1) {
      const ids = sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1).getValues().flat()
      if (ids.indexOf(data['Call ID']) !== -1) {
        return json({ ok: true, duplicate: true })
      }
    }

    sheet.appendRow(header.map(function (h) { return data[h] === undefined ? '' : data[h] }))
    return json({ ok: true })
  } catch (err) {
    return json({ ok: false, error: String(err) })
  } finally {
    lock.releaseLock()
  }
}

function doGet() {
  return json({ ok: true, message: 'CARE Forms Survey receiver is running.' })
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
