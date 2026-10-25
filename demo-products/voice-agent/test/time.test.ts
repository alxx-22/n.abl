import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, isIsoDate, normaliseTime, offsetMinutes, spokenDate, spokenTime, toLocal, zonedToUtc,
} from '../src/domain/time.ts';

const TZ = 'Europe/London';

test('BST and GMT offsets', () => {
  assert.equal(offsetMinutes(Date.UTC(2026, 6, 1, 12), TZ), 60);
  assert.equal(offsetMinutes(Date.UTC(2026, 11, 1, 12), TZ), 0);
});

test('local → UTC in summer and winter', () => {
  assert.equal(zonedToUtc('2026-07-10', '19:30', TZ).toISOString(), '2026-07-10T18:30:00.000Z');
  assert.equal(zonedToUtc('2026-12-10', '19:30', TZ).toISOString(), '2026-12-10T19:30:00.000Z');
});

test('the October clock change: 25 October 2026', () => {
  // Clocks go back at 02:00 BST. Evening bookings that day are GMT.
  assert.equal(zonedToUtc('2026-10-24', '19:00', TZ).toISOString(), '2026-10-24T18:00:00.000Z');
  assert.equal(zonedToUtc('2026-10-25', '19:00', TZ).toISOString(), '2026-10-25T19:00:00.000Z');
  assert.equal(toLocal(new Date('2026-10-25T19:00:00Z'), TZ).time, '19:00');
});

test('the March clock change: 29 March 2026', () => {
  assert.equal(zonedToUtc('2026-03-28', '12:00', TZ).toISOString(), '2026-03-28T12:00:00.000Z');
  assert.equal(zonedToUtc('2026-03-29', '12:00', TZ).toISOString(), '2026-03-29T11:00:00.000Z');
});

test('round trip for every quarter hour across a clock-change weekend', () => {
  for (const date of ['2026-10-24', '2026-10-25', '2026-10-26']) {
    for (let m = 6 * 60; m < 24 * 60; m += 15) {
      const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const local = toLocal(zonedToUtc(date, time, TZ), TZ);
      assert.equal(`${local.date} ${local.time}`, `${date} ${time}`);
    }
  }
});

test('weekday comes out in the tenant timezone', () => {
  // 23:30 UTC on Saturday 31 October is still Saturday in London (GMT).
  assert.equal(toLocal(new Date('2026-10-31T23:30:00Z'), TZ).weekday, 6);
  // 23:30 UTC on Friday 3 July is 00:30 Saturday in London (BST).
  assert.equal(toLocal(new Date('2026-07-03T23:30:00Z'), TZ).weekday, 6);
});

test('dates and times as the model sends them', () => {
  assert.ok(isIsoDate('2026-02-28'));
  assert.ok(!isIsoDate('2026-02-30'));
  assert.ok(!isIsoDate('Friday'));
  assert.equal(normaliseTime('19:30'), '19:30');
  assert.equal(normaliseTime('7:30pm'), '19:30');
  assert.equal(normaliseTime('7pm'), '19:00');
  assert.equal(normaliseTime('1930'), '19:30');
  assert.equal(normaliseTime('12am'), '00:00');
  assert.equal(normaliseTime('half seven'), null);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('spoken forms', () => {
  assert.equal(spokenDate('2026-10-02'), 'Friday 2 October');
  assert.equal(spokenTime('19:30'), '7:30pm');
  assert.equal(spokenTime('12:00'), '12 noon');
  assert.equal(spokenTime('09:00'), '9am');
  assert.equal(spokenTime('24:00'), 'midnight', 'a closing time at the end of the day');
  assert.equal(spokenTime('00:00'), 'midnight');
});
