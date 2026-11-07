import fs from 'fs';
import path from 'path';
import { db, uploadsDir } from '../server/db.js';
import { uploadToR2, getObjectFromR2, deleteFromR2, getEffectiveR2Config, isR2Configured } from '../server/r2.js';
import { saveDatabaseToFirestoreNow, loadDatabaseFromFirestore } from '../server/firestore.js';

async function runTestSuite() {
  console.log('====================================================');
  console.log('   INDOOR MEDIA SYSTEM E2E VALIDATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  // TEST 1: Cloudflare R2 Configuration & Connectivity
  console.log('--- TEST GROUP 1: Cloudflare R2 & Storage ---');
  const r2Config = getEffectiveR2Config();
  const configured = isR2Configured(r2Config);
  assert(configured, 'Cloudflare R2 is configured and enabled');

  const testKey = `test-e2e-${Date.now()}.txt`;
  const testBuffer = Buffer.from('E2E validation test string for Cloudflare R2 persistence', 'utf8');
  const uploadRes = await uploadToR2({
    buffer: testBuffer,
    key: testKey,
    contentType: 'text/plain',
  });
  assert(Boolean(uploadRes?.publicUrl), 'Direct upload to Cloudflare R2 succeeded', uploadRes);

  const getRes = await getObjectFromR2(testKey);
  assert(Boolean(getRes && getRes.body), 'Direct retrieval from Cloudflare R2 succeeded');

  const delRes = await deleteFromR2(testKey);
  assert(delRes, 'Deletion from Cloudflare R2 succeeded');

  // TEST 2: Firestore Persistence
  console.log('\n--- TEST GROUP 2: Firebase Firestore Database Persistence ---');
  try {
    const fsSaveSuccess = await saveDatabaseToFirestoreNow(db.getData());
    assert(fsSaveSuccess, 'saveDatabaseToFirestoreNow succeeded without permissions errors');

    const cloudData = await loadDatabaseFromFirestore();
    assert(Boolean(cloudData?.status === 'found' && cloudData?.data?.companies?.length > 0), 'loadDatabaseFromFirestore returned valid company data');
  } catch (fsErr: any) {
    assert(false, 'Firestore save/load threw error', fsErr?.message || fsErr);
  }

  // TEST 3: User Authentication & Session
  console.log('\n--- TEST GROUP 3: Authentication & Session Token ---');
  let authToken = '';
  try {
    const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ale11062@gmail.com',
        password: 'Admin@123456',
      }),
    });
    const loginData = (await loginRes.json()) as any;
    authToken = loginData.token;
    assert(loginRes.ok && Boolean(authToken), 'Admin login successful and returned valid token');
  } catch (authErr: any) {
    assert(false, 'Admin login failed', authErr?.message || authErr);
  }

  // TEST 4: MP4 Video Playback (Local & Cloud)
  console.log('\n--- TEST GROUP 4: MP4 Video Playback (Local & Cloud) ---');
  const sampleVideoPath = '/tmp/test_video.mp4';
  assert(fs.existsSync(sampleVideoPath), 'Sample test video exists at /tmp/test_video.mp4');

  const videoBuffer = fs.readFileSync(sampleVideoPath);
  const videoBase64 = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;

  // Upload video via server API (creates local file + uploads to Cloudflare R2)
  let createdMedia: any = null;
  try {
    const uploadMediaRes = await fetch('http://127.0.0.1:3000/api/company/media/upload-to-drive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Vídeo Promocional Teste E2E (MP4)',
        filename: 'video-promocional-teste-e2e.mp4',
        mimeType: 'video/mp4',
        duration: 5,
        fileData: videoBase64,
        addToAllPlaylists: true,
      }),
    });
    const uploadData = (await uploadMediaRes.json()) as any;
    createdMedia = uploadData.media;
    assert(uploadMediaRes.ok && Boolean(createdMedia?.id), 'Video uploaded via server API and registered in database', createdMedia?.id);
    assert(Boolean(createdMedia?.file_url?.includes('r2.dev') || createdMedia?.local_url), 'Video assigned Cloudflare R2 URL and local URL');
  } catch (upErr: any) {
    assert(false, 'Failed uploading video via server API', upErr?.message || upErr);
  }

  // Verify local file exists on disk
  const localFileName = createdMedia?.local_url ? path.basename(createdMedia.local_url) : '';
  const localDiskPath = localFileName ? path.join(uploadsDir, localFileName) : '';
  assert(fs.existsSync(localDiskPath), 'Video stored locally on disk in /uploads/');

  // Test local streaming with HTTP Range (206 Partial Content)
  try {
    const streamRes = await fetch(`http://127.0.0.1:3000/api/media/stream/${createdMedia.id}`, {
      headers: { Range: 'bytes=0-1000' },
    });
    assert(streamRes.status === 206, `/api/media/stream/:id returns 206 Partial Content for Range requests (got ${streamRes.status})`);
    assert(streamRes.headers.get('content-type')?.includes('video/mp4') ?? false, `/api/media/stream/:id serves Content-Type video/mp4`);
    assert(streamRes.headers.get('content-range')?.includes('bytes 0-1000') ?? false, `/api/media/stream/:id returns Content-Range header`);
  } catch (streamErr: any) {
    assert(false, 'Failed requesting video stream', streamErr?.message || streamErr);
  }

  // TEST 5: Multi-Device Cloud-to-Local Recovery
  console.log('\n--- TEST GROUP 5: Multi-Device Cloud-to-Local Recovery ---');
  // Simulate secondary device (smart TV / smartphone): delete local file from disk
  fs.unlinkSync(localDiskPath);
  assert(!fs.existsSync(localDiskPath), 'Simulated cache-miss on secondary device: local file removed from disk');

  // Request from server /uploads/ route
  try {
    const recoverRes = await fetch(`http://127.0.0.1:3000/uploads/${localFileName}`, {
      headers: { Range: 'bytes=0-500' },
    });
    assert(recoverRes.status === 206 || recoverRes.status === 200, `/uploads/${localFileName} recovered from R2 with status ${recoverRes.status}`);
    assert(fs.existsSync(localDiskPath), 'File downloaded from Cloudflare R2 and cached locally for offline play');
  } catch (recErr: any) {
    assert(false, 'Multi-device recovery failed', recErr?.message || recErr);
  }

  // TEST 6: Playlist Integration & Player Screen Playback
  console.log('\n--- TEST GROUP 6: Playlist Integration & Player Playback ---');
  try {
    const playerRes = await fetch('http://127.0.0.1:3000/api/player/current');
    const playerData = (await playerRes.json()) as any;
    assert(playerRes.ok && Boolean(playerData.player), '/api/player/current responds with 200 OK');

    const videoInPlayer = playerData.items?.find((it: any) => it.media_id === createdMedia.id);
    assert(Boolean(videoInPlayer), 'Uploaded video is present in player playlist items');
    assert(videoInPlayer?.type === 'video', 'Video item in playlist has correct type "video"');
    assert(
      Boolean(videoInPlayer?.local_url || videoInPlayer?.file_url),
      'Video item has valid local_url and cloud file_url for player playback'
    );
  } catch (plErr: any) {
    assert(false, 'Player playlist integration failed', plErr?.message || plErr);
  }

  // TEST 7: Multi-Device Image Viewing
  console.log('\n--- TEST GROUP 7: Multi-Device Image Viewing ---');
  const imgBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const imgFileName = `media-img-${Date.now()}.png`;
  const localImgPath = path.join(uploadsDir, imgFileName);
  await uploadToR2({
    buffer: imgBuffer,
    key: imgFileName,
    contentType: 'image/png',
  });
  // Simulate request on another device without local copy
  const imgFetchRes = await fetch(`http://127.0.0.1:3000/uploads/${imgFileName}`);
  assert(imgFetchRes.ok, `Image restored on demand from R2 via /uploads/ with status ${imgFetchRes.status}`);
  assert(fs.existsSync(localImgPath), 'Restored image cached locally for subsequent requests');

  // TEST 8: Safe Media Deletion (No Resurrections)
  console.log('\n--- TEST GROUP 8: Safe Media Deletion ---');
  try {
    const delRes = await fetch(`http://127.0.0.1:3000/api/company/media/${createdMedia.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(delRes.ok, `DELETE /api/company/media/:id returned ${delRes.status}`);

    // Verify it is purged from player playlist
    const playerAfterDel = await fetch('http://127.0.0.1:3000/api/player/current');
    const playerAfterData = (await playerAfterDel.json()) as any;
    const stillInPlayer = playerAfterData.items?.some((it: any) => it.media_id === createdMedia.id);
    assert(!stillInPlayer, 'Deleted video cleanly removed from player playlist without resurrection');

    // Clean up temporary image
    await deleteFromR2(imgFileName);
    if (fs.existsSync(localImgPath)) fs.unlinkSync(localImgPath);
  } catch (delErr: any) {
    assert(false, 'Media deletion failed', delErr?.message || delErr);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
