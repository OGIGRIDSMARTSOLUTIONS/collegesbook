const { z } = require('zod');

const updatePrivacySchema = z.object({
  whoCanMessage: z.enum(['NOBODY_EXCEPT_CONNECTIONS', 'SET_ONLY', 'INSTITUTION_ONLY']).optional(),
  whoCanViewProfile: z.enum(['CONNECTIONS_ONLY', 'SET_ONLY', 'INSTITUTION_ONLY', 'EVERYONE']).optional(),
  whoCanViewPosts: z.enum(['CONNECTIONS_ONLY', 'SET_ONLY', 'INSTITUTION_ONLY', 'EVERYONE']).optional(),
  showBirthday: z.boolean().optional(),
});

module.exports = { updatePrivacySchema };
