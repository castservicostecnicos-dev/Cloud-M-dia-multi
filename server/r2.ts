import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
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

export async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const config = getEffectiveR2Config();
    if (!isR2Configured(config)) return false;

    const client = createR2Client(config);
    const command = new DeleteObjectCommand({
      Bucket: config.bucket_name,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch (err) {
    console.warn('[Cloudflare R2] Falha ao deletar objeto:', key, err);
    return false;
  }
}
