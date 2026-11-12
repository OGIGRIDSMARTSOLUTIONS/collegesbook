const { resend, isEmailConfigured, fromAddress } = require('../config/resend');

async function sendRegistrationOtp(email, code) {
  if (!isEmailConfigured()) throw new Error('Resend is not configured');

  const result = await resend.emails.send({
    from: fromAddress(),
    to: email,
    subject: 'Your CollegeBook registration verification code',
    text: `Your CollegeBook verification code is ${code}. It expires in 5 minutes. Do not share this code.`,
  });

  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message || 'Resend did not accept the email');
  }
}

module.exports = { sendRegistrationOtp };
