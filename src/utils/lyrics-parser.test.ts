import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLRC, parseTTML, parseLyrics, timeStringToMs, getActiveLineIndex } from './lyrics-parser.ts';

test('timeStringToMs correctly parses timestamps', () => {
  assert.equal(timeStringToMs('00:12.50'), 12500);
  assert.equal(timeStringToMs('01:30.00'), 90000);
  assert.equal(timeStringToMs('01:02:03.50'), 3723500);
  assert.equal(timeStringToMs('12.5s'), 12500);
  assert.equal(timeStringToMs('1500ms'), 1500);
});

test('parseLRC parses standard and enhanced LRC with word timestamps', () => {
  const lrc = `[ti:Test Song]
[ar:Test Artist]
[al:Test Album]
[00:05.00]First line of song
[00:10.00]<00:10.00>Hello <00:11.20>beautiful <00:12.50>world
[00:16.00]Third line
`;

  const parsed = parseLRC(lrc);
  assert.equal(parsed.format, 'enhanced-lrc');
  assert.equal(parsed.hasWordSync, true);
  assert.equal(parsed.lines.length, 3);
  assert.equal(parsed.lines[0].text, 'First line of song');
  assert.equal(parsed.lines[0].startMs, 5000);
  assert.equal(parsed.lines[0].endMs, 10000);

  // Check word-level timing in line 2
  const words = parsed.lines[1].words;
  assert.ok(words && words.length === 3);
  assert.equal(words[0].text, 'Hello');
  assert.equal(words[0].startMs, 10000);
  assert.equal(words[0].endMs, 11200);
  assert.equal(words[0].isSustained, true); // duration 1200ms >= 800ms

  assert.equal(words[1].text, 'beautiful');
  assert.equal(words[1].startMs, 11200);
  assert.equal(words[1].endMs, 12500);

  assert.equal(words[2].text, 'world');
});

test('parseTTML supports relative parent timing, seq containers, and nested spans', () => {
  const ttml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:02.00" end="00:06.00">
        <span begin="00:00.00" dur="00:01.00">Never</span>
        <span begin="00:01.20" dur="00:00.80">gonna</span>
        <span begin="00:02.00" dur="00:01.50">give</span>
      </p>
      <p begin="00:07.00" end="00:11.00">
        <span begin="00:00.00" dur="00:01.00">You</span>
        <span begin="00:01.20" dur="00:02.00">up</span>
      </p>
    </div>
  </body>
</tt>`;

  const parsed = parseTTML(ttml);
  assert.equal(parsed.format, 'ttml');
  assert.equal(parsed.hasWordSync, true);
  assert.equal(parsed.lines.length, 2);

  // Line 1 should start at 2000ms
  assert.equal(parsed.lines[0].startMs, 2000);
  assert.equal(parsed.lines[0].endMs, 6000);

  // Words inside line 1 should have absolute times relative to parent (2000ms + offset)
  const words1 = parsed.lines[0].words;
  assert.ok(words1 && words1.length === 3);
  assert.equal(words1[0].text, 'Never');
  assert.equal(words1[0].startMs, 2000);
  assert.equal(words1[0].endMs, 3000);

  assert.equal(words1[1].text, 'gonna');
  assert.equal(words1[1].startMs, 3200);

  assert.equal(words1[2].text, 'give');
  assert.equal(words1[2].startMs, 4000);
  assert.equal(words1[2].endMs, 5500);
  assert.equal(words1[2].isSustained, true); // duration 1500ms >= 800ms
});

test('getActiveLineIndex finds the current active line accurately', () => {
  const lines = [
    { id: '1', startMs: 1000, endMs: 4000, text: 'One' },
    { id: '2', startMs: 4000, endMs: 8000, text: 'Two' },
    { id: '3', startMs: 8000, endMs: 12000, text: 'Three' },
  ];

  assert.equal(getActiveLineIndex(lines, 500), -1);
  assert.equal(getActiveLineIndex(lines, 1000), 0);
  assert.equal(getActiveLineIndex(lines, 3999), 0);
  assert.equal(getActiveLineIndex(lines, 4000), 1);
  assert.equal(getActiveLineIndex(lines, 7999), 1);
  assert.equal(getActiveLineIndex(lines, 8000), 2);
});
