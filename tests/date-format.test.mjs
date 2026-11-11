import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDateBR, formatDateForFile } from '../app/lib/date-format.js';

test('civil dates display with two-digit day/month and four-digit year without a time zone shift', () => {
    for (const value of ['2026-01-04', '2026-01-04T00:00:00.000Z', '2026-01-04 00:00:00', '04/01/2026']) {
        assert.equal(formatDateBR(value), '04/01/2026');
        assert.equal(formatDateForFile(value), '04-01-2026');
    }
    assert.equal(formatDateBR('2024-02-29'), '29/02/2024');
});

test('invalid and missing dates never leak ISO strings or Invalid Date to the interface', () => {
    for (const value of [null, undefined, '', 'bad-date', '2026-02-29', '2026-04-31', new Date('invalid')]) {
        assert.equal(formatDateBR(value), '—');
        assert.equal(formatDateBR(value, ''), '');
        if (value !== undefined) assert.equal(formatDateForFile(value), 'sem-data');
    }
});

test('generated filename dates follow Brasília time across UTC midnight and year changes', () => {
    assert.equal(formatDateForFile(new Date('2027-01-01T01:30:00Z')), '31-12-2026');
    assert.equal(formatDateBR(new Date('2027-01-01T03:00:00Z')), '01/01/2027');
    assert.equal(formatDateForFile(new Date('2026-11-04T15:00:00Z')), '04-11-2026');
});
