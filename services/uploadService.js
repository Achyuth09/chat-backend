import { getCloudinary, hasCloudinaryConfig } from '../config/cloudinary.js';

function resourceTypeFromMime(mimeType = '') {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'raw';
}

function uploadStream({ buffer, folder, mimeType }) {
  const cloudinary = getCloudinary();
  const resourceType = resourceTypeFromMime(mimeType);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function uploadMedia(file, folder = 'chat-app') {
  if (!hasCloudinaryConfig()) {
    throw new Error('Cloudinary is not configured');
  }
  if (!file?.buffer) throw new Error('Missing file buffer');

  const result = await uploadStream({
    buffer: file.buffer,
    folder,
    mimeType: file.mimetype,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    type: result.resource_type,
    width: result.width || null,
    height: result.height || null,
    duration: result.duration || null,
    originalName: file.originalname || null,
    bytes: result.bytes || file.size || null,
    format: result.format || null,
  };
}
