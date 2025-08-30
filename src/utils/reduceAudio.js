import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

export async function reduceAudio(inputPath, outputPath, maxSizeMB = 24, bitrate = '64k') {
  // Check if input file is a valid audio file and get its format
  const getAudioFormat = (filePath) => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        const stream = metadata.streams.find(s => s.codec_type === 'audio');
        if (!stream) return reject(new Error('Input file is not a valid audio file'));
        resolve(stream.codec_name);
      });
    });
  };

  let tempInputPath = inputPath;
  let shouldDeleteTemp = false;

  try {
    const format = await getAudioFormat(inputPath);
    if (format !== 'mp3') {
      // Convert to mp3 first
      const tempMp3Path = path.join(path.dirname(inputPath), `${path.parse(inputPath).name}_temp.mp3`);
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat('mp3')
          .save(tempMp3Path)
          .on('end', resolve)
          .on('error', reject);
      });
      tempInputPath = tempMp3Path;
      shouldDeleteTemp = true;
    }
  } catch (err) {
    // Delete input file if not valid audio
    try { await fs.unlink(inputPath); } catch {}
    throw err;
  }

  return new Promise((resolve, reject) => {
    ffmpeg(tempInputPath)
      .audioBitrate(bitrate)
      .save(outputPath)
      .on('end', async () => {
        try {
          const stats = await fs.stat(outputPath);
          if (stats.size > maxSizeMB * 1024 * 1024) {
            await fs.unlink(outputPath);
            await fs.unlink(inputPath);
            if (shouldDeleteTemp) await fs.unlink(tempInputPath);
            return reject(new Error('File size exceeds maximum allowed size'));
          }
          await fs.unlink(inputPath);
          if (shouldDeleteTemp) await fs.unlink(tempInputPath);
          resolve(outputPath);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', async (error) => {
        try {
          await fs.unlink(outputPath);
          await fs.unlink(inputPath);
          if (shouldDeleteTemp) await fs.unlink(tempInputPath);
        } catch (e) {
          // ignore if file doesn't exist
          console.log(e)
        }
        console.error('Error processing audio:', error);
        reject(error);
      });
  });
}