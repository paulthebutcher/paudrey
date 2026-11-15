const test = require('node:test');
const assert = require('node:assert/strict');
const {createCalendar,parseCalendarDate,escapeCalendarText,foldCalendarLine} = require('../interactions.js');
const now = new Date('2026-10-24T02:30:00Z');

test('unknown and invalid dates do not produce a calendar file', () => {
  for (const date of [null,undefined,'','[Wedding date]','2027-02-29','2028-02-30','2027-13-01','2027-01-00','2027-1-01','2027-01-01T12:00:00Z']) {
    assert.equal(parseCalendarDate(date),null);
    assert.equal(createCalendar({date},{now}),null);
  }
});

test('all-day events end on the following date across leap days and year boundaries', () => {
  const leap = createCalendar({date:'2028-02-29'},{now});
  assert.match(leap,/DTSTART;VALUE=DATE:20280229\r\n/);
  assert.match(leap,/DTEND;VALUE=DATE:20280301\r\n/);
  const year = createCalendar({date:'2027-12-31'},{now});
  assert.match(year,/DTEND;VALUE=DATE:20280101\r\n/);
  assert.match(year,/DTSTAMP:20261024T023000Z\r\n/);
  assert.doesNotMatch(year,/TZID|DTSTART:\d{8}T/);
});

test('calendar text is escaped, preventing injected properties', () => {
  const value = 'Cabin, meadow; trail\\home\r\nBEGIN:VEVENT';
  assert.equal(escapeCalendarText(value),'Cabin\\, meadow\\; trail\\\\home\\nBEGIN:VEVENT');
  const output = createCalendar({date:'2027-06-11',location:value},{now});
  assert.equal((output.match(/\r\nBEGIN:VEVENT\r\n/g) || []).length,1);
  assert.match(output,/LOCATION:Cabin\\, meadow\\; trail\\\\home\\nBEGIN:VEVENT\r\n/);
});

test('folded lines stay within 75 UTF-8 octets and unfold without losing characters', () => {
  const original = 'DESCRIPTION:' + 'A decade together — déjà vu. '.repeat(20);
  const folded = foldCalendarLine(original);
  for (const line of folded.split('\r\n')) assert.ok(Buffer.byteLength(line,'utf8') <= 75);
  assert.equal(folded.replace(/\r\n /g,''),original);
});

test('unknown location is omitted and the file uses CRLF throughout', () => {
  const output = createCalendar({date:'2027-03-14',location:null},{now});
  assert.doesNotMatch(output,/LOCATION:/);
  assert.doesNotMatch(output.replace(/\r\n/g,''),/[\r\n]/);
  assert.ok(output.endsWith('END:VCALENDAR\r\n'));
});
