/**
 * Audio helper for LRCGlass
 * Supports HTML5 audio playback, local file object URLs, and instant test audio synthesis
 */

/**
 * Generates an in-memory melodic WAV audio blob for immediate playback verification
 * Creates a soothing gentle ambient chord progression matching song timing.
 */
export function generateTestAudioBlob(durationSeconds = 180): string {
  const sampleRate = 22050;
  const numChannels = 1;
  const numSamples = Math.min(durationSeconds * sampleRate, 60 * sampleRate); // Max 60s synthesized chunk
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write gentle warm musical chord progression (C - G - Am - F)
  const chords = [
    [261.63, 329.63, 392.0], // C major (C4, E4, G4)
    [196.0, 246.94, 293.66], // G major (G3, B3, D4)
    [220.0, 261.63, 329.63], // A minor (A3, C4, E4)
    [174.61, 220.0, 261.63], // F major (F3, A3, C4)
  ];

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.floor(t / 4) % chords.length;
    const currentChord = chords[chordIndex];

    let sample = 0;
    for (let c = 0; c < currentChord.length; c++) {
      const freq = currentChord[c];
      // Gentle sine + soft overtone + envelope
      const env = Math.exp(-((t % 4) * 0.4));
      sample += Math.sin(2 * Math.PI * freq * t) * 0.15 * env;
      sample += Math.sin(4 * Math.PI * freq * t) * 0.05 * env;
    }

    // Clamp 16-bit PCM (-32768 to 32767)
    const intSample = Math.max(-1, Math.min(1, sample)) * 0.7 * 32767;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
