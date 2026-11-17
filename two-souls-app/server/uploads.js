import { randomUUID } from 'node:crypto';
import { del, get, put } from '@vercel/blob';
import { ensureDatabase, getDatabase } from './db.js';
import { HttpError, readJson } from './http.js';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const PUBLIC_TYPES = new Map([
  ['image/jpeg', { extension: 'jpg', signatures: [[0xff, 0xd8, 0xff]] }],
  ['image/png', { extension: 'png', signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] }],
  ['image/webp', { extension: 'webp', riff: true }],
  ['image/gif', { extension: 'gif', signatures: [[0x47, 0x49, 0x46, 0x38]] }],
  ['image/avif', { extension: 'avif', avif: true }],
]);
const PRIVATE_TYPES = new Map([
  ...PUBLIC_TYPES,
  ['application/pdf', { extension: 'pdf', signatures: [[0x25, 0x50, 0x44, 0x46, 0x2d]] }],
]);

function startsWith(bytes, signature) {
  return signature.every((value, index) => bytes[index] === value);
}

function validSignature(bytes, descriptor) {
  if (descriptor.signatures?.some(signature => startsWith(bytes, signature))) return true;
  if (descriptor.riff) {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
  }
  if (descriptor.avif) {
    return String.fromCharCode(...bytes.subarray(4, 12)).includes('ftyp')
      && String.fromCharCode(...bytes.subarray(8, 32)).includes('avif');
  }
  return false;
}

function decodeUpload(payload, visibility) {
  if (!payload || typeof payload !== 'object') throw new HttpError(400, 'A file is required.');
  const mimeType = String(payload.type || '').toLowerCase();
  const types = visibility === 'public' ? PUBLIC_TYPES : PRIVATE_TYPES;
  const descriptor = types.get(mimeType);
  if (!descriptor) throw new HttpError(415, visibility === 'public'
    ? 'Upload a JPEG, PNG, WebP, GIF, or AVIF image.'
    : 'Upload an image or PDF receipt.');
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(payload.data || ''));
  if (!match || match[1].toLowerCase() !== mimeType) throw new HttpError(400, 'The uploaded file data is invalid.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_FILE_BYTES || Number(payload.size) !== bytes.length) {
    throw new HttpError(413, 'Files must be no larger than 3 MB.');
  }
  if (!validSignature(bytes, descriptor)) throw new HttpError(415, 'The file contents do not match its file type.');
  return {
    bytes,
    mimeType,
    extension: descriptor.extension,
    originalName: String(payload.name || 'upload').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180),
  };
}

export async function uploadFile(request, visibility, user) {
  if (!['public', 'private'].includes(visibility)) throw new HttpError(404, 'Upload route not found.');
  if (visibility === 'public' && user?.role !== 'admin') throw new HttpError(403, 'Administrator access is required.');
  const file = decodeUpload(await readJson(request, 4_500_000), visibility);
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(503, 'Vercel Blob is not configured.');

  await ensureDatabase();
  const id = randomUUID();
  const pathname = `${visibility}/${new Date().toISOString().slice(0, 10)}/${id}.${file.extension}`;
  const blob = await put(pathname, file.bytes, {
    access: visibility,
    addRandomSuffix: false,
    contentType: file.mimeType,
    cacheControlMaxAge: visibility === 'public' ? 31_536_000 : 60,
  });
  try {
    await getDatabase()`insert into files
      (id, owner_id, blob_url, blob_path, visibility, mime_type, size_bytes, original_name)
      values (${id}, ${user?.id || null}, ${blob.url}, ${blob.pathname}, ${visibility},
        ${file.mimeType}, ${file.bytes.length}, ${file.originalName})`;
  } catch (error) {
    await del(blob.url).catch(() => {});
    throw error;
  }
  return visibility === 'public'
    ? { file_url: blob.url }
    : { file_uri: `private:${id}` };
}

export async function downloadPrivateFile(id, user, request) {
  if (!user) throw new HttpError(401, 'Sign in required.');
  await ensureDatabase();
  const rows = await getDatabase()`select * from files where id = ${String(id)} and visibility = 'private' limit 1`;
  const file = rows[0];
  if (!file) throw new HttpError(404, 'File not found.');
  if (user.role !== 'admin' && file.owner_id !== user.id) throw new HttpError(403, 'You do not have access to this file.');
  const result = await get(file.blob_path, { access: 'private' });
  if (!result) throw new HttpError(404, 'File not found.');
  if (result.statusCode === 304) return new Response(null, { status: 304 });
  const headers = new Headers(result.headers);
  headers.set('Content-Type', file.mime_type);
  headers.set('Content-Disposition', `inline; filename="${String(file.original_name || 'receipt').replace(/["\\]/g, '_')}"`);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(result.stream, { status: 200, headers });
}

export const uploadInternals = { decodeUpload, MAX_FILE_BYTES };
