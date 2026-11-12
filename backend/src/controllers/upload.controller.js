const uploadService = require('../services/upload.service');
const { ApiError, ok } = require('../utils/apiResponse');

async function uploadHandler(req, res, next) {
  try {
    if (!req.file) throw new ApiError('No file uploaded', 400);
    const { purpose } = req.body;
    const result = purpose === 'document'
      ? await uploadService.processAndUploadPdf(req.context, { buffer: req.file.buffer })
      : await uploadService.processAndUploadImage(req.context, {
        purpose,
        buffer: req.file.buffer,
      });
    return ok(res, result);
  } catch (error) {
    next(error);
  }
}

module.exports = { uploadHandler };
