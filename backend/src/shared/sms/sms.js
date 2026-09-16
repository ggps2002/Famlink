import twilio from 'twilio';

// Load client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


export const sendOtpSMS = async (to, otp) => {
  try {
    const messageBody = `Famlink Verification Code: ${otp}. This code is valid for 15 minutes. Do not share it with anyone.`;

    const result = await client.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE,
      to: to, // Example: +91XXXXXXXXXX
    });

    console.log('✅ SMS sent:', result.sid);
    return result.sid;
  } catch (err) {
    console.error('❌ SMS OTP sending error:', err.message);
    throw err;
  }
};


export const sendSMS = async (to, message) => {
    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE,
            to, // Example: +9198xxxxxxx
        });
        console.log('✅ SMS sent:', result.sid);
        return result.sid;
    } catch (err) {
        console.error('❌ SMS sending error:', err.message);
        throw err;
    }
};


