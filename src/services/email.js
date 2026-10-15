// src/services/email.js
// v3-P2-6: Email service stub. Replace with real transport (SendGrid/Mailgun/SES)
// when deploying to production. For now, logs to console so dev can click the link.
//
// The stub takes (toEmail, resetUrl) and just console.log()s them. Once a real
// transport is wired up, swap the body of `sendPasswordResetEmail` for the
// transport's API call — the function signature stays the same.

export async function sendPasswordResetEmail(toEmail, resetUrl) {
  // v3-P2-6: In dev, the user's "email" is their username (no email field on User).
  // We log to console so the dev can click the reset link. In prod, replace this
  // body with a real send (SendGrid/Mailgun/SES) once User.email is wired up.
  console.log(`\n[EMAIL STUB] To: ${toEmail}`);
  console.log(`[EMAIL STUB] Subject: Reset your password`);
  console.log(`[EMAIL STUB] Body: ${resetUrl}\n`);
}

export default { sendPasswordResetEmail };
