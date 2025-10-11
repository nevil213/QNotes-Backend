function isLikelyText(buf, sampleSize = 1024) {
  const len = Math.min(buf.length, sampleSize);
  let controlChars = 0;
  let nullBytes = 0;
  for (let i = 0; i < len; i++) {
    const code = buf[i];
    if (code === 0) nullBytes++; // Null bytes indicate binary
    // Allow common whitespace and printable ASCII
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) continue;
    // Allow UTF-8 continuation bytes (128-191) and start bytes (192-255)
    if (code >= 128) continue;
    controlChars++;
  }
  // Reject if too many control chars or null bytes
  if (controlChars > len * 0.05 || nullBytes > 0) return false;
  return true;
}

export async function parseFile(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    console.error('[Parser] Input is not a buffer');
    return null;
  }

  try {
    console.log('[Parser] Parsing buffer of size:', buffer.length);
    // Quick PDF check
    const header4 = buffer.slice(0, 4).toString('utf8', 0, 4);
    if (header4 === '%PDF') {
      console.log('[Parser] Detected PDF, parsing...');
      try {
        // Use CommonJS require instead of import
        const pdfParse = require('pdf-parse');
        console.log('[Parser] PDF parser loaded successfully:', typeof pdfParse);
        
        const data = await pdfParse(buffer);
        const text = data && data.text ? data.text.trim() : '';
        console.log('[Parser] PDF parsed, text length:', text.length);
        return text;
      } catch (pdfErr) {
        console.error('[Parser] PDF parsing error details:', pdfErr);
        throw new Error(`PDF parsing failed: ${pdfErr.message}`);
      }
    }

    // Only accept plain-text buffers otherwise
    if (isLikelyText(buffer)) {
      console.log('[Parser] Detected likely text, converting to UTF-8');
      const text = buffer.toString('utf8').trim();
      console.log('[Parser] Text parsed, length:', text.length);
      return text;
    }

    console.log('[Parser] Buffer is not PDF or text, skipping');
    return null;
  } catch (err) {
    console.error('[Parser] Error parsing buffer:', err.message);
    return null;
  }
}
