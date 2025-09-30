import ffmpeg from 'fluent-ffmpeg';
import streamifier from 'streamifier';

// Helper function to detect audio format from buffer
function detectAudioFormat(buffer) {
  const header = buffer.slice(0, 12);
  
  // Check for various audio format signatures
  if (header.slice(0, 4).toString() === 'fLaC') return 'FLAC';
  if (header.slice(0, 3).toString() === 'ID3' || header.slice(0, 2).toString('hex') === 'fffa' || header.slice(0, 2).toString('hex') === 'fffb') return 'MP3';
  if (header.slice(4, 8).toString() === 'ftyp') return 'MP4/M4A';
  if (header.slice(0, 4).toString() === 'OggS') return 'OGG';
  if (header.slice(0, 4).toString() === 'RIFF' && header.slice(8, 12).toString() === 'WAVE') return 'WAV';
  if (header.slice(0, 4).toString('hex') === '1a45dfa3') return 'WEBM';
  
  return 'UNKNOWN';
}

export async function reduceAudioBuffer(inputBuffer, options = {}) {
  const {
    maxSizeMB = 24,
    bitrate = '64k',
    convertToOpus = true,
  } = options;

  const inputSizeMB = inputBuffer.length / (1024 * 1024);
  const detectedFormat = detectAudioFormat(inputBuffer);
  const skipFormats = ['FLAC', 'MP3', 'MP4/M4A', 'OGG', 'WEBM'];
  const shouldSkipConversion = skipFormats.includes(detectedFormat);
  
  console.log(`[AudioReduce] Input buffer size: ${inputSizeMB.toFixed(2)} MB`);
  console.log(`[AudioReduce] Detected format: ${detectedFormat}`);
  console.log(`[AudioReduce] Should skip conversion: ${shouldSkipConversion}`);
  console.log(`[AudioReduce] Options:`, { maxSizeMB, bitrate, convertToOpus });
  
  // If file is already small enough
  if (inputSizeMB < 25) {
    console.log(`[AudioReduce] File size < 25MB, applying light processing`);
    
    // If conversion to Opus is not needed or format should be skipped, return original buffer
    if (!convertToOpus || shouldSkipConversion) {
      console.log(`[AudioReduce] No conversion needed (convertToOpus: ${convertToOpus}, skipFormat: ${shouldSkipConversion}), returning original buffer`);
      return inputBuffer;
    }
    
    console.log(`[AudioReduce] Converting to Opus format with 128k bitrate (quality preservation)`);
    // Only convert format without heavy compression for small files
    const inputStream = streamifier.createReadStream(inputBuffer);
    const outputChunks = [];

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputStream)
        .format('opus')
        .audioBitrate('128k') // Higher bitrate for small files to maintain quality
        .on('error', (err) => {
          console.error(`[AudioReduce] FFmpeg error during light conversion:`, err);
          reject(err);
        })
        .on('end', () => {
          const outputBuffer = Buffer.concat(outputChunks);
          const outputSizeMB = outputBuffer.length / (1024 * 1024);
          console.log(`[AudioReduce] Light conversion completed. Output size: ${outputSizeMB.toFixed(2)} MB`);
          resolve(outputBuffer);
        })
        .pipe()
        .on('data', chunk => outputChunks.push(chunk));
    });
  }

  console.log(`[AudioReduce] File size >= 25MB, applying heavy compression`);
  
  // For large files, still compress even if format should normally be skipped
  if (shouldSkipConversion) {
    console.log(`[AudioReduce] Large file detected - forcing compression despite format being ${detectedFormat}`);
  }
  
  console.log(`[AudioReduce] Using bitrate: ${bitrate}, target max size: ${maxSizeMB} MB`);
  
  // Original compression logic for large files (>= 50MB)
  const inputStream = streamifier.createReadStream(inputBuffer);
  const outputChunks = [];

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputStream)
      .format(convertToOpus ? 'opus' : 'wav')
      .audioBitrate(bitrate)
      .on('error', (err) => {
        console.error(`[AudioReduce] FFmpeg error during heavy compression:`, err);
        reject(err);
      })
      .on('end', async () => {
        const outputBuffer = Buffer.concat(outputChunks);
        const outputSizeMB = outputBuffer.length / (1024 * 1024);
        console.log(`[AudioReduce] Heavy compression completed. Output size: ${outputSizeMB.toFixed(2)} MB`);
        
        if (outputBuffer.length > maxSizeMB * 1024 * 1024) {
          console.error(`[AudioReduce] Output size (${outputSizeMB.toFixed(2)} MB) exceeds maximum allowed size (${maxSizeMB} MB)`);
          return reject(new Error('File size exceeds maximum allowed size'));
        }
        
        console.log(`[AudioReduce] Compression successful, size within limits`);
        resolve(outputBuffer);
      })
      .pipe()
      .on('data', chunk => outputChunks.push(chunk));
  });
}