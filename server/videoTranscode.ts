import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ProcessedVideoResult {
  outputPath: string;
  filename: string;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
  buffer: Buffer;
}

/**
 * Probes video duration and dimensions using ffprobe
 */
export async function probeVideoMetadata(filePath: string): Promise<{
  duration?: number;
  width?: number;
  height?: number;
}> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=width,height',
      '-of',
      'json',
      filePath,
    ]);
    const info = JSON.parse(stdout);
    const duration = info.format?.duration ? Math.round(parseFloat(info.format.duration)) : undefined;
    const videoStream = info.streams?.find((s: any) => s.width && s.height);
    const width = videoStream?.width;
    const height = videoStream?.height;
    return { duration, width, height };
  } catch (err) {
    console.warn('[Video Probe] Warning running ffprobe:', err);
    return {};
  }
}

/**
 * Optimizes videos for universal web playback across Smart TVs, browsers and mobile devices.
 * - Transcodes AVI, MKV, WMV to web-standard H.264 (yuv420p) + AAC audio.
 * - Moves MP4 `moov` atom to the beginning of the file (-movflags +faststart) for instant zero-stall streaming.
 */
export async function processAndOptimizeVideo(
  inputFilePath: string,
  targetFilename: string
): Promise<ProcessedVideoResult> {
  const ext = path.extname(targetFilename).toLowerCase();
  const dir = path.dirname(inputFilePath);
  const baseName = path.basename(targetFilename, ext);
  const mp4Filename = `${baseName}.mp4`;
  const outputFilePath = path.join(dir, `opt_${mp4Filename}`);

  const isAviOrNonStandard = ext === '.avi' || ext === '.mkv' || ext === '.wmv' || ext === '.ogv';

  try {
    if (isAviOrNonStandard) {
      console.log(`[Video Optimizer] Transcoding non-standard video ${targetFilename} to Web H.264 MP4 with faststart...`);
      await execFileAsync('ffmpeg', [
        '-y',
        '-i',
        inputFilePath,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-profile:v',
        'high',
        '-level',
        '4.1',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputFilePath,
      ]);
    } else {
      // First attempt fast stream-copy with faststart (instant 0-second re-mux)
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          inputFilePath,
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          outputFilePath,
        ]);
      } catch (copyErr) {
        console.warn('[Video Optimizer] Stream copy failed, re-encoding to web-safe H.264:', copyErr);
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          inputFilePath,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-movflags',
          '+faststart',
          outputFilePath,
        ]);
      }
    }

    if (fs.existsSync(outputFilePath) && fs.statSync(outputFilePath).size > 0) {
      const meta = await probeVideoMetadata(outputFilePath);
      const buffer = fs.readFileSync(outputFilePath);

      // Clean up temp output if different from final destination
      const finalDestPath = path.join(dir, mp4Filename);
      if (outputFilePath !== finalDestPath) {
        fs.renameSync(outputFilePath, finalDestPath);
      }
      // If original input was different (e.g. .avi), clean up original
      if (inputFilePath !== finalDestPath && fs.existsSync(inputFilePath)) {
        try {
          fs.unlinkSync(inputFilePath);
        } catch {}
      }

      console.log(`[Video Optimizer] Successfully optimized ${mp4Filename} (${buffer.length} bytes, faststart active).`);
      return {
        outputPath: finalDestPath,
        filename: mp4Filename,
        mimeType: 'video/mp4',
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        buffer,
      };
    }
  } catch (err: any) {
    console.warn('[Video Optimizer] Error during ffmpeg optimization, falling back to raw file:', err?.message || err);
  }

  // Fallback to original file
  const fallbackBuffer = fs.readFileSync(inputFilePath);
  const meta = await probeVideoMetadata(inputFilePath);
  return {
    outputPath: inputFilePath,
    filename: targetFilename,
    mimeType: ext === '.avi' ? 'video/x-msvideo' : 'video/mp4',
    duration: meta.duration,
    width: meta.width,
    height: meta.height,
    buffer: fallbackBuffer,
  };
}
