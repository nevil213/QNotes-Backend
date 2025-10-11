import * as pdfParse from 'pdf-parse';

function isLikelyText(buf, sampleSize = 1024) {
  const len = Math.min(buf.length, sampleSize);
  let controlChars = 0;
  for (let i = 0; i < len; i++) {
    const code = buf[i];
    // Allow tab(9), LF(10), CR(13), and printable range 32-126 and UTF-8 multibyte start bytes (>127)
    if (code === 9 || code === 10 || code === 13) continue;
    if (code >= 32 && code <= 126) continue;
    if (code >= 128) continue; // treat as potential UTF-8 multibyte (heuristic)
    controlChars++;
    if (controlChars > len * 0.1) return false;
  }
  return true;
}

export async function parseFile(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;

  try {
    // Quick PDF check
    const header4 = buffer.slice(0, 4).toString('utf8', 0, 4);
    if (header4 === '%PDF') {
      const data = await pdfParse(buffer);
      return data && data.text ? data.text : '';
    }

    // Only accept plain-text buffers otherwise
    if (isLikelyText(buffer)) {
      return buffer.toString('utf8');
    }

    // Not PDF or text — do not parse other formats
    return null;
  } catch (err) {
    console.error('[Parser] error parsing buffer:', err);
    return null;
  }
}
