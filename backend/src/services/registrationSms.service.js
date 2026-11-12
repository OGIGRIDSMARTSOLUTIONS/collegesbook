/** Termii SMS adapter. Never log codes or API keys. */
async function sendRegistrationOtp(phone, code) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://v3.api.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: process.env.TERMII_API_KEY,
        to: phone,
        from: process.env.TERMII_SENDER_ID,
        sms: `Your CollegeBook registration code is ${code}. It expires in 5 minutes. Do not share it.`,
        type: 'plain',
        channel: process.env.TERMII_CHANNEL || 'generic',
      }),
    });
    if (!response.ok) throw new Error(`SMS gateway HTTP ${response.status}`);
    const result = await response.json();
    if (!result.message_id && !result.messageId) throw new Error('SMS gateway did not confirm delivery acceptance');
  } finally {
    clearTimeout(timeout);
  }
}
module.exports = { sendRegistrationOtp };
