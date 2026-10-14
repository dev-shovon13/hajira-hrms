import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/config/env';
import { AppError } from '@/utils/AppError';

export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

const useCloudinary = Boolean(env.CLOUDINARY_URL);
if (useCloudinary) cloudinary.config({ secure: true }); // reads CLOUDINARY_URL

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOC_TYPES = [...IMAGE_TYPES, 'application/pdf'];

const EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function upload(allowed: string[]) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (allowed.includes(file.mimetype)) return cb(null, true);
      cb(AppError.badRequest(`Unsupported file type. Use ${allowed.map((t) => EXT[t]).join(', ')}`, 'BAD_FILE_TYPE'));
    },
  });
}

export const avatarUpload = upload(IMAGE_TYPES).single('file');
export const attachmentUpload = upload(DOC_TYPES).single('file');

/** Checks magic bytes so a renamed file cannot pass as an image or PDF. */
function sniff(buffer: Buffer): string | null {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  return null;
}

export async function storeFile(file: Express.Multer.File, folder: 'avatars' | 'attachments') {
  const detected = sniff(file.buffer);
  if (!detected || detected !== file.mimetype) {
    throw AppError.badRequest('The file content does not match its type', 'BAD_FILE_CONTENT');
  }

  if (useCloudinary) {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `hajira/${folder}`,
          resource_type: detected === 'application/pdf' ? 'raw' : 'image',
          ...(folder === 'avatars' ? { transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }] } : {}),
        },
        (err, res) => (err || !res ? reject(err) : resolve(res)),
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, name: file.originalname, size: file.size, type: detected };
  }

  const name = `${crypto.randomUUID()}${EXT[detected]}`;
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), file.buffer);
  // Relative URL: the web app proxies /uploads to this API, so files stay same-origin.
  return { url: `/uploads/${folder}/${name}`, name: file.originalname, size: file.size, type: detected };
}
