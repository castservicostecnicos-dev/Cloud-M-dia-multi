import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { db } from './db';
import { R2Settings } from '../src/types';

export function sanitizeR2AccountId(raw: string | undefined): string {
  if (!raw) return '';
  let clean = raw.trim();
  clean = clean.replace(/^https?:\/\//i, '');
  clean = clean.replace(/\.r2\.cloudflarestorage\.com.*$/i, '');
  clean = clean.replace(/dash\.cloudflare\.com\/?/i, '');
  clean = clean.split('/')[0];
  return clean.trim();
}

export function sanitizeR2BucketName(raw: string | undefined): string {
  if (!raw) return '';
  let clean = raw.trim();
  clean = clean.replace(/^https?:\/\//i, '');
  clean = clean.replace(/\/.*$/, '');
  return clean.trim();
}

export function getEffectiveR2Config(): R2Settings {
  const dbData = db.getData();
  const dbSettings = dbData.r2_settings || { enabled: false };

  // Environment variables have fallback priority
  const account_id = sanitizeR2AccountId(dbSettings.account_id || process.env.R2_ACCOUNT_ID || '');
  const access_key_id = (dbSettings.access_key_id || process.env.R2_ACCESS_KEY_ID || '').trim();
  const secret_access_key = (dbSettings.secret_access_key || process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket_name = sanitizeR2BucketName(dbSettings.bucket_name || process.env.R2_BUCKET_NAME || '');
  const public_domain = (dbSettings.public_domain || process.env.R2_PUBLIC_DOMAIN || '').trim();
  const enabled = dbSettings.enabled !== undefined
    ? dbSettings.enabled
    : Boolean(account_id && access_key_id && secret_access_key && bucket_name);

  return {
    enabled,
    account_id,
    access_key_id,
    secret_access_key,
    bucket_name,
    public_domain,
    auto_upload_on_add: dbSettings.auto_upload_on_add ?? true,
    last_tested_at: dbSettings.last_tested_at,
    last_test_status: dbSettings.last_test_status,
    last_test_message: dbSettings.last_test_message,
  };
}

export function isR2Configured(config = getEffectiveR2Config()): boolean {
  const accountId = sanitizeR2AccountId(config.account_id);
  const accessKeyId = (config.access_key_id || '').trim();
  const secretAccessKey = (config.secret_access_key || '').trim();
  const bucketName = sanitizeR2BucketName(config.bucket_name);
  return Boolean(accountId && accessKeyId && secretAccessKey && bucketName);
}

export function createR2Client(config = getEffectiveR2Config()): S3Client {
  const accountId = sanitizeR2AccountId(config.account_id);
  const accessKeyId = (config.access_key_id || '').trim();
  const secretAccessKey = (config.secret_access_key || '').trim();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Credenciais do Cloudflare R2 incompletas (Account ID, Access Key ID ou Secret Key ausente).');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function buildR2PublicUrl(key: string, config = getEffectiveR2Config()): string {
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  if (config.public_domain && config.public_domain.trim()) {
    let domain = config.public_domain.trim();
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    domain = domain.replace(/\/+$/, '');
    return `${domain}/${cleanKey}`;
  }

  const accountId = sanitizeR2AccountId(config.account_id);
  const bucketName = sanitizeR2BucketName(config.bucket_name);
  return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${cleanKey}`;
}

export async function testR2Connection(customConfig?: Partial<R2Settings>): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const rawConfig = {
      ...getEffectiveR2Config(),
      ...(customConfig || {}),
    };

    const config: R2Settings = {
      ...rawConfig,
      account_id: sanitizeR2AccountId(rawConfig.account_id),
      access_key_id: (rawConfig.access_key_id || '').trim(),
      secret_access_key: (rawConfig.secret_access_key || '').trim(),
      bucket_name: sanitizeR2BucketName(rawConfig.bucket_name),
    };

    if (!config.account_id || !config.access_key_id || !config.secret_access_key || !config.bucket_name) {
      return {
        success: false,
        message: 'Preencha Account ID, Access Key ID, Secret Key e Nome do Bucket para testar.',
      };
    }

    const client = createR2Client(config);
    const command = new ListObjectsV2Command({
      Bucket: config.bucket_name,
      MaxKeys: 1,
    });

    const response = await client.send(command);
    return {
      success: true,
      message: `Conexão com o Cloudflare R2 estabelecida com sucesso! Bucket "${config.bucket_name}" acessível.`,
      details: {
        bucket: config.bucket_name,
        keyCount: response.KeyCount ?? 0,
      },
    };
  } catch (err: any) {
    const msg = err.message || 'Falha ao autenticar no Cloudflare R2.';
    return {
      success: false,
      message: `Erro ao conectar no Cloudflare R2: ${msg}`,
      details: { code: err.name || err.Code },
    };
  }
}

export async function uploadToR2(params: {
  buffer: Buffer;
  key: string;
  contentType: string;
}): Promise<{ publicUrl: string; key: string; size: number }> {
  const config = getEffectiveR2Config();
  if (!isR2Configured(config)) {
    throw new Error('Cloudflare R2 não está configurado.');
  }

  const client = createR2Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket_name,
    Key: params.key,
    Body: params.buffer,
    ContentType: params.contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await client.send(command);
  const publicUrl = buildR2PublicUrl(params.key, config);

  return {
    publicUrl,
    key: params.key,
    size: params.buffer.length,
  };
}

export function extractR2Key(keyOrUrl: string | undefined): string | null {
  if (!keyOrUrl) return null;
  let key = String(keyOrUrl).trim();

  // If it's a URL
  if (key.includes('://')) {
    try {
      const parsed = new URL(key);
      key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    } catch {
      key = key.split('?')[0].split('/').pop() || key;
    }
  } else {
    // Strip leading slashes, api prefixes, or uploads/ prefix
    key = key.split('?')[0];
    key = key.replace(/^\/+/, '');
    key = key.replace(/^api\/media\/stream\/+/, '');
    key = key.replace(/^uploads\/+/, '');
  }

  // Remove trailing slashes
  key = key.replace(/\/+$/, '').trim();

  // Non-R2 targets
  if (!key || key.startsWith('widget:') || key.startsWith('data:') || key.startsWith('idb:') || key.startsWith('blob:')) {
    return null;
  }

  return key;
}

export async function deleteFromR2(keyOrUrl: string): Promise<boolean> {
  try {
    const config = getEffectiveR2Config();
    if (!isR2Configured(config)) return false;
    if (!keyOrUrl) return false;

    const key = extractR2Key(keyOrUrl);
    if (!key) return false;

    const client = createR2Client(config);
    const command = new DeleteObjectCommand({
      Bucket: config.bucket_name,
      Key: key,
    });
    await client.send(command);
    console.log('[Cloudflare R2] Objeto excluído com sucesso do bucket:', key);
    return true;
  } catch (err: any) {
    console.warn('[Cloudflare R2] Falha ao deletar objeto:', keyOrUrl, err?.message || err);
    return false;
  }
}

export async function listR2Objects(maxKeys = 1000): Promise<Array<{ key: string; size: number; lastModified?: Date }>> {
  try {
    const config = getEffectiveR2Config();
    if (!isR2Configured(config)) return [];

    const client = createR2Client(config);
    const command = new ListObjectsV2Command({
      Bucket: config.bucket_name,
      MaxKeys: maxKeys,
    });

    const res = await client.send(command);
    return (res.Contents || []).map((o) => ({
      key: o.Key || '',
      size: o.Size || 0,
      lastModified: o.LastModified,
    })).filter((o) => Boolean(o.key));
  } catch (err: any) {
    console.warn('[Cloudflare R2] Falha ao listar objetos do bucket:', err?.message || err);
    return [];
  }
}

export async function cleanupOrphanR2Media(): Promise<{
  totalInR2: number;
  orphansFound: number;
  deletedCount: number;
  freedBytes: number;
  deletedKeys: string[];
}> {
  const config = getEffectiveR2Config();
  if (!isR2Configured(config)) {
    return { totalInR2: 0, orphansFound: 0, deletedCount: 0, freedBytes: 0, deletedKeys: [] };
  }

  const objects = await listR2Objects(1000);
  const dbData = db.getData();
  const allMedia = dbData.media || [];

  // Build a set of all active R2 keys/filenames currently referenced by any media
  const activeKeys = new Set<string>();
  for (const m of allMedia) {
    const urls = [m.file_url, m.local_url, (m as any).r2_url].filter(Boolean);
    for (const u of urls) {
      const extracted = extractR2Key(u);
      if (extracted) {
        activeKeys.add(extracted);
        activeKeys.add(extracted.toLowerCase());
      }
      // Also record base filename
      try {
        const fn = u.split('?')[0].split('/').pop();
        if (fn) {
          activeKeys.add(fn);
          activeKeys.add(fn.toLowerCase());
        }
      } catch {}
    }
  }

  let deletedCount = 0;
  let freedBytes = 0;
  const deletedKeys: string[] = [];

  for (const obj of objects) {
    const k = obj.key;
    const isReferenced = activeKeys.has(k) || activeKeys.has(k.toLowerCase());

    if (!isReferenced) {
      // It is an orphan object in R2 with no media in the app!
      console.log('[Cloudflare R2 Cleanup] Excluindo mídia órfã/inútil do bucket:', k, `(${obj.size} bytes)`);
      const success = await deleteFromR2(k);
      if (success) {
        deletedCount++;
        freedBytes += obj.size;
        deletedKeys.push(k);
      }
    }
  }

  return {
    totalInR2: objects.length,
    orphansFound: deletedKeys.length,
    deletedCount,
    freedBytes,
    deletedKeys,
  };
}

export async function getObjectFromR2(keyOrUrl: string, range?: string): Promise<{
  body: any;
  contentLength?: number;
  contentType?: string;
  contentRange?: string;
  acceptRanges?: string;
  status: number;
} | null> {
  try {
    const config = getEffectiveR2Config();
    if (!isR2Configured(config)) return null;

    let key = keyOrUrl.trim();
    if (key.includes('://')) {
      try {
        const parsed = new URL(key);
        key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
      } catch {
        key = key.split('/').pop() || key;
      }
    } else {
      key = key.replace(/^\/+/, '').replace(/^uploads\/+/, '');
    }

    if (!key || key.startsWith('widget:') || key.startsWith('data:') || key.startsWith('idb:')) {
      return null;
    }

    const client = createR2Client(config);
    const command = new GetObjectCommand({
      Bucket: config.bucket_name,
      Key: key,
      Range: range || undefined,
    });

    const res = await client.send(command);
    return {
      body: res.Body,
      contentLength: res.ContentLength,
      contentType: res.ContentType,
      contentRange: res.ContentRange,
      acceptRanges: res.AcceptRanges,
      status: range && res.ContentRange ? 206 : 200,
    };
  } catch (err: any) {
    console.warn('[Cloudflare R2] Falha ao obter objeto para streaming:', keyOrUrl, err?.message || err);
    return null;
  }
}


