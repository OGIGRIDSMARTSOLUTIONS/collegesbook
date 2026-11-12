const { z } = require('zod');

const uploadRequestSchema = z.object({
  purpose: z.enum(['profile', 'cover', 'post', 'yearbook', 'institution-logo', 'document']),
});

module.exports = { uploadRequestSchema };
