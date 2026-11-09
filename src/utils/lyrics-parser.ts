/**
 * LRCGlass — Advanced Synchronized Lyrics Engine
 * Supports Standard LRC, Enhanced LRC (word sync), and TTML (Timed Text Markup Language)
 * with hierarchical relative parent timing, <seq> and <par> containers, and word-level spans.
 */

export interface LyricWord {
  text: string;
  startMs: number;
  endMs: number;
  isSustained?: boolean; // Sustained if duration >= 800ms
}

export interface LyricLine {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words?: LyricWord[];
  isInstrumental?: boolean;
  speaker?: string;
  translatedText?: string;
}

export interface ParsedLyrics {
  format: 'lrc' | 'enhanced-lrc' | 'ttml' | 'plain';
  hasWordSync: boolean;
  hasLineSync: boolean;
  durationMs: number;
  lines: LyricLine[];
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    author?: string;
    by?: string;
    source?: string;
    offsetMs?: number;
  };
}

/**
 * Converts mm:ss.xx or mm:ss:xx or seconds to milliseconds
 */
export function timeStringToMs(timeStr: string): number {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim();

  // Check ms format like "1500ms"
  if (/^(\d+)ms$/i.test(trimmed)) {
    return parseInt(trimmed, 10) || 0;
  }

  // Check seconds format like "12.34s" or "12.34"
  if (/^(\d+(\.\d+)?)s?$/i.test(trimmed)) {
    return Math.round(parseFloat(trimmed) * 1000);
  }

  // Check mm:ss.xx or hh:mm:ss.xx
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return Math.round((mins * 60 + secs) * 1000);
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return Math.round((hours * 3600 + mins * 60 + secs) * 1000);
  }

  return 0;
}

/**
 * Parses LRC and Enhanced LRC files
 */
export function parseLRC(lrcContent: string): ParsedLyrics {
  if (!lrcContent || typeof lrcContent !== 'string') {
    return { format: 'plain', hasWordSync: false, hasLineSync: false, durationMs: 0, lines: [] };
  }

  const lines = lrcContent.split(/\r?\n/);
  const parsedLines: LyricLine[] = [];
  const metadata: Record<string, string> = {};
  let hasWordSync = false;
  let offsetMs = 0;

  const metaRegex = /^\[(ti|ar|al|au|by|offset):(.*)\]$/i;
  const timeRegex = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g;
  const wordTimeRegex = /<(\d{1,2}:\d{2}(?:\.\d{1,3})?)>([^<]+)/g;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Check for metadata tags
    const metaMatch = rawLine.match(metaRegex);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();
      metadata[key] = val;
      if (key === 'offset') {
        offsetMs = parseInt(val, 10) || 0;
      }
      continue;
    }

    // Check for timestamps: [00:12.34]
    const timeMatches = [...rawLine.matchAll(timeRegex)];
    if (timeMatches.length > 0) {
      const lineText = rawLine.replace(timeRegex, '').trim();

      // Check for Enhanced LRC word timestamps: <00:12.34> word
      const wordMatches = [...lineText.matchAll(wordTimeRegex)];
      let words: LyricWord[] | undefined;

      if (wordMatches.length > 0) {
        hasWordSync = true;
        words = [];
        for (let w = 0; w < wordMatches.length; w++) {
          const wStart = timeStringToMs(wordMatches[w][1]) + offsetMs;
          const wText = wordMatches[w][2].trim();
          let wEnd = wStart + 400; // default estimate
          if (w + 1 < wordMatches.length) {
            wEnd = timeStringToMs(wordMatches[w + 1][1]) + offsetMs;
          }
          const duration = Math.max(0, wEnd - wStart);
          words.push({
            text: wText,
            startMs: wStart,
            endMs: wEnd,
            isSustained: duration >= 800,
          });
        }
      }

      const cleanText = words ? words.map((w) => w.text).join(' ') : lineText;

      for (const tMatch of timeMatches) {
        const startMs = timeStringToMs(tMatch[1]) + offsetMs;
        parsedLines.push({
          id: `line-${i}-${startMs}`,
          startMs,
          endMs: startMs + 3000, // will refine with next line
          text: cleanText,
          words,
          isInstrumental: cleanText === '...' || cleanText === '♪' || /^\s*\[instrumental\]\s*$/i.test(cleanText),
        });
      }
    } else {
      // Plain line without timestamps
      parsedLines.push({
        id: `line-${i}`,
        startMs: 0,
        endMs: 0,
        text: rawLine,
      });
    }
  }

  // Sort by startMs
  parsedLines.sort((a, b) => a.startMs - b.startMs);

  // Compute endMs based on succeeding line's startMs
  for (let i = 0; i < parsedLines.length; i++) {
    if (i < parsedLines.length - 1 && parsedLines[i + 1].startMs > parsedLines[i].startMs) {
      parsedLines[i].endMs = parsedLines[i + 1].startMs;
    } else {
      parsedLines[i].endMs = parsedLines[i].startMs + 4000;
    }

    // Refine last word in wordSync line if available
    if (parsedLines[i].words && parsedLines[i].words!.length > 0) {
      const lastWord = parsedLines[i].words![parsedLines[i].words!.length - 1];
      if (lastWord.endMs <= lastWord.startMs) {
        lastWord.endMs = parsedLines[i].endMs;
      }
      lastWord.isSustained = lastWord.endMs - lastWord.startMs >= 800;
    }
  }

  const hasLineSync = parsedLines.some((l) => l.startMs > 0);
  const durationMs = parsedLines.length > 0 ? parsedLines[parsedLines.length - 1].endMs : 0;

  return {
    format: hasWordSync ? 'enhanced-lrc' : hasLineSync ? 'lrc' : 'plain',
    hasWordSync,
    hasLineSync,
    durationMs,
    lines: parsedLines,
    metadata: {
      title: metadata['ti'],
      artist: metadata['ar'],
      album: metadata['al'],
      author: metadata['au'],
      by: metadata['by'],
      offsetMs,
    },
  };
}

/**
 * Parses TTML (Timed Text Markup Language) documents with support for
 * relative parent timing, <seq> and <par> containers, nested elements,
 * begin, end, and dur attributes, and word-level <span> elements.
 */
export function parseTTML(ttmlXml: string): ParsedLyrics {
  if (!ttmlXml || typeof ttmlXml !== 'string') {
    return { format: 'plain', hasWordSync: false, hasLineSync: false, durationMs: 0, lines: [] };
  }

  const lines: LyricLine[] = [];
  let hasWordSync = false;

  // Helper to parse time in TTML: e.g. "00:01:23.456", "12.34s", "1234ms"
  function parseTtmlTime(val: string | undefined): number {
    if (!val) return 0;
    const trimmed = val.trim();
    if (trimmed.endsWith('ms')) {
      return parseInt(trimmed.replace('ms', ''), 10) || 0;
    }
    if (trimmed.endsWith('s')) {
      return Math.round(parseFloat(trimmed.replace('s', '')) * 1000);
    }
    return timeStringToMs(trimmed);
  }

  // Regex matcher for TTML tags
  // Matches container tags <seq>, <par>, <p>, <div>, <span>
  // Supports attributes: begin, end, dur
  const pTagRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  const spanTagRegex = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*["']([^"']*)["']/g;

  function parseAttributes(attrStr: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(attrStr)) !== null) {
      const key = match[1].toLowerCase().replace(/^tt:\s*/, '');
      attrs[key] = match[2];
    }
    return attrs;
  }

  // Check if root containers have <seq> or <par>
  // In a <seq> container, children without explicit begin follow previous child end
  const isSequentialContainer = /<seq\b/i.test(ttmlXml);
  let accumulatedSeqTime = 0;

  let pIndex = 0;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pTagRegex.exec(ttmlXml)) !== null) {
    const pAttrs = parseAttributes(pMatch[1]);
    const pInner = pMatch[2];

    let pBegin = parseTtmlTime(pAttrs['begin']);
    const pDur = parseTtmlTime(pAttrs['dur']);
    let pEnd = parseTtmlTime(pAttrs['end']);

    if (isSequentialContainer && !pAttrs['begin']) {
      pBegin = accumulatedSeqTime;
    }

    if (pDur > 0 && pEnd === 0) {
      pEnd = pBegin + pDur;
    } else if (pEnd === 0) {
      pEnd = pBegin + 4000;
    }

    accumulatedSeqTime = pEnd;

    // Check for inner word-level <span> elements
    const wordSpans: LyricWord[] = [];
    let spanMatch: RegExpExecArray | null;
    const innerSpansRegex = new RegExp(spanTagRegex.source, 'gi');

    // First pass: collect raw span timing to detect if relative to pBegin
    interface RawSpan {
      attrs: Record<string, string>;
      text: string;
      begin: number;
      dur: number;
      end: number;
    }
    const rawSpans: RawSpan[] = [];
    while ((spanMatch = innerSpansRegex.exec(pInner)) !== null) {
      const sAttrs = parseAttributes(spanMatch[1]);
      const sText = spanMatch[2].replace(/<[^>]+>/g, '').trim();
      if (!sText) continue;
      const b = parseTtmlTime(sAttrs['begin']);
      const d = parseTtmlTime(sAttrs['dur']);
      const e = parseTtmlTime(sAttrs['end']);
      rawSpans.push({ attrs: sAttrs, text: sText, begin: b, dur: d, end: e });
    }

    // If any span begin is less than pBegin or first span starts near 0 while pBegin is non-zero,
    // all spans in this <p> use relative timing relative to pBegin.
    const isRelative = rawSpans.length > 0 && pBegin > 0 && (rawSpans[0].begin < pBegin || rawSpans.some(s => s.begin < pBegin));

    let rawAccumulatedText = '';
    for (const s of rawSpans) {
      let sBegin = isRelative ? pBegin + s.begin : s.begin;
      let sEnd = s.end;
      if (s.dur > 0 && sEnd === 0) {
        sEnd = sBegin + s.dur;
      } else if (isRelative && sEnd > 0) {
        sEnd = pBegin + sEnd;
      } else if (sEnd === 0) {
        sEnd = sBegin + 300;
      }

      const duration = Math.max(0, sEnd - sBegin);
      hasWordSync = true;
      wordSpans.push({
        text: s.text,
        startMs: sBegin,
        endMs: sEnd,
        isSustained: duration >= 800,
      });

      rawAccumulatedText += (rawAccumulatedText ? ' ' : '') + s.text;
    }

    // Clean text: strip any remaining xml tags
    const lineText = wordSpans.length > 0 ? rawAccumulatedText : pInner.replace(/<[^>]+>/g, '').trim();

    if (lineText || wordSpans.length > 0) {
      lines.push({
        id: `ttml-p-${pIndex++}`,
        startMs: pBegin,
        endMs: pEnd,
        text: lineText,
        words: wordSpans.length > 0 ? wordSpans : undefined,
        isInstrumental: lineText === '...' || lineText === '♪' || /^\s*\[instrumental\]\s*$/i.test(lineText),
      });
    }
  }

  // Sort lines chronologically
  lines.sort((a, b) => a.startMs - b.startMs);

  const durationMs = lines.length > 0 ? lines[lines.length - 1].endMs : 0;

  return {
    format: 'ttml',
    hasWordSync,
    hasLineSync: lines.length > 0,
    durationMs,
    lines,
  };
}

/**
 * Universal Lyrics Parser
 * Auto-detects TTML, Enhanced LRC, Standard LRC, or plain lyrics.
 */
export function parseLyrics(content: string, formatHint?: string): ParsedLyrics {
  if (!content) {
    return { format: 'plain', hasWordSync: false, hasLineSync: false, durationMs: 0, lines: [] };
  }

  const trimmed = content.trim();

  // TTML check
  if (formatHint === 'ttml' || trimmed.startsWith('<tt') || trimmed.includes('<tt ') || trimmed.includes('xmlns="http://www.w3.org/ns/ttml"')) {
    return parseTTML(trimmed);
  }

  // LRC check
  if (formatHint === 'lrc' || /\[\d{1,2}:\d{2}/.test(trimmed)) {
    return parseLRC(trimmed);
  }

  // Fallback to plain text
  const plainLines = trimmed.split(/\r?\n/).map((line, idx) => ({
    id: `plain-${idx}`,
    startMs: 0,
    endMs: 0,
    text: line.trim(),
  })).filter((l) => l.text.length > 0);

  return {
    format: 'plain',
    hasWordSync: false,
    hasLineSync: false,
    durationMs: 0,
    lines: plainLines,
  };
}

/**
 * Finds the currently active lyric line index for a given playback timestamp in ms
 */
export function getActiveLineIndex(lines: LyricLine[], currentMs: number): number {
  if (!lines || lines.length === 0) return -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (currentMs >= line.startMs && currentMs < line.endMs) {
      return i;
    }
  }

  // If before first line
  if (currentMs < lines[0].startMs) {
    return -1;
  }

  // If between lines or past last line, return the closest previous line
  for (let i = lines.length - 1; i >= 0; i--) {
    if (currentMs >= lines[i].startMs) {
      return i;
    }
  }

  return -1;
}

/**
 * Formats milliseconds into mm:ss
 */
export function formatTime(ms: number): string {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
