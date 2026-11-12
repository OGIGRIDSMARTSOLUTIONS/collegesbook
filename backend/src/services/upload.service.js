const crypto = require('crypto');
const sharp = require('sharp');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { ApiError } = require('../utils/apiResponse');

const IMAGE_SETTINGS = {
  profile: { width: 800, height: 800, quality: 82 },
  cover: { width: 1600, height: 900, quality: 80 },
  post: { width: 1600, height: 1600, quality: 82 },
  yearbook: { width: 1000, height: 1400, quality: 85 },
  'institution-logo': { width: 1000, height: 1000, quality: 90 },
};

function actorFolder(actor, purpose) {
  // Never accept institution/student IDs from the request body.
  const institution = actor.institutionId || 'platform';
  if (purpose === 'institution-logo' || purpose === 'yearbook' || purpose === 'document') {
    if (!actor.institutionId && actor.role !== 'SUPER_ADMIN') {
      throw new ApiError('Institution context is required', 403);
    }
    return `collegebook/institutions/${institution}/${purpose}`;
  }
  if (!actor.studentId) throw new ApiError('Student account is required for this upload', 403);
  return `collegebook/institutions/${institution}/students/${actor.studentId}/${purpose}`;
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.on('error', reject);
    stream.end(buffer);
  });
}

async function processAndUploadImage(actor, { purpose, buffer }) {
  if (!isCloudinaryConfigured()) throw new ApiError('Cloudinary uploads are not configured', 503);
  const settings = IMAGE_SETTINGS[purpose];
  if (!settings) throw new ApiError('Unknown image purpose', 400);
  let processed;
  try {
    processed = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(settings.width, settings.height, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: settings.quality, effort: 4 })
      .toBuffer();
  } catch {
    throw new ApiError('Invalid or unsupported image file', 422);
  }
  try {
    const result = await uploadBuffer(processed, {
      folder: actorFolder(actor, purpose),
      public_id: `${Date.now()}-${crypto.randomUUID()}`,
      resource_type: 'image',
      format: 'webp',
      overwrite: false,
    });
    return { url: result.secure_url, publicId: result.public_id, format: 'webp' };
  } catch {
    throw new ApiError('Image upload failed; please retry', 502);
  }
}

async function processAndUploadPdf(actor, { buffer }) {
  if (!isCloudinaryConfigured()) throw new ApiError('Cloudinary uploads are not configured', 503);
  // Verify actual PDF signature, not only the browser-provided MIME type.
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new ApiError('A valid PDF document is required', 422);
  }
  try {
    const result = await uploadBuffer(buffer, {
      folder: actorFolder(actor, 'document'),
      public_id: `${Date.now()}-${crypto.randomUUID()}.pdf`,
      resource_type: 'raw',
      overwrite: false,
    });
    // This URL is public. Do not use this route for confidential documents.
    return { url: result.secure_url, publicId: result.public_id, format: 'pdf' };
  } catch {
    throw new ApiError('PDF upload failed; please retry', 502);
  }
}

module.exports = { processAndUploadImage, processAndUploadPdf };
