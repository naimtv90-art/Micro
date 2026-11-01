const nodemailer = require('nodemailer');
const https = require('https');
const { contentStore } = require('./contentStore');

/**
 * Send appointment notification email to microhearingaidbd@gmail.com
 * Supports:
 * 1) Direct Gmail / SMTP via Nodemailer (when App Password / SMTP_PASS is configured)
 * 2) FormSubmit.co Relay fallback
 */
async function sendAppointmentEmail(appointment) {
  const settings = contentStore.getEmailSettings();
  const recipient = settings.recipientEmail || 'microhearingaidbd@gmail.com';
  const subject = `New Appointment Request: ${appointment.name} (${appointment.phone}) - ${appointment.branchName}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #006837; color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 20px;">📅 New Appointment Booking Request</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #bbf7d0;">Micro Hearing Care Centre (MHCC) – Online Booking</p>
      </div>
      <div style="padding: 24px; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; width: 150px;"><strong>Patient Name:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: bold;">${appointment.name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;"><strong>Phone Number:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
              <a href="tel:${appointment.phone}" style="color: #006837; font-weight: bold; text-decoration: none;">${appointment.phone}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;"><strong>Clinic Branch:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${appointment.branchName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;"><strong>Preferred Time:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${appointment.preferredDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;"><strong>Age Group:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${appointment.ageGroup}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;"><strong>Patient Notes:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a;">${appointment.message}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b;"><strong>Submitted At:</strong></td>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">${appointment.createdAt}</td>
          </tr>
        </table>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px;">
          <a href="tel:${appointment.phone}" style="background: #006837; color: #ffffff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; margin-right: 10px;">
            📞 Call Patient
          </a>
          <a href="https://wa.me/88${appointment.phone.replace(/[^0-9]/g, '').replace(/^88/, '')}" style="background: #16a34a; color: #ffffff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            💬 WhatsApp Patient
          </a>
        </div>
      </div>
    </div>
  `;

  // 1. Try direct SMTP via Nodemailer if password is provided
  if (settings.smtpPass && settings.smtpUser) {
    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost || 'smtp.gmail.com',
        port: Number(settings.smtpPort) || 465,
        secure: (Number(settings.smtpPort) || 465) === 465,
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPass
        }
      });

      await transporter.sendMail({
        from: `"Micro Hearing Aid Centre" <${settings.smtpUser}>`,
        to: recipient,
        subject,
        html: htmlBody
      });

      contentStore.updateAppointment(appointment.id, { emailStatus: 'Sent (SMTP)', emailTo: recipient });
      return { sent: true, method: 'smtp', recipient };
    } catch (smtpErr) {
      console.error('[EmailService] SMTP error:', smtpErr.message);
    }
  }

  // 2. Fallback: Trigger FormSubmit.co AJAX endpoint for microhearingaidbd@gmail.com
  try {
    const payload = JSON.stringify({
      _subject: subject,
      _template: 'table',
      _captcha: 'false',
      'Patient Name': appointment.name,
      'Phone Number': appointment.phone,
      'Clinic Branch': appointment.branchName,
      'Preferred Date / Time': appointment.preferredDate,
      'Patient Age Group': appointment.ageGroup,
      'Hearing Concerns / Notes': appointment.message,
      'Submitted At': appointment.createdAt
    });

    await new Promise((resolve) => {
      const req = https.request(
        `https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://microhearingaidbd.com',
            'Referer': 'https://microhearingaidbd.com/contact-us',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 6000
        },
        (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => resolve(body));
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(payload);
      req.end();
    });

    contentStore.updateAppointment(appointment.id, { emailStatus: 'Sent (Email Relay)', emailTo: recipient });
    return { sent: true, method: 'relay', recipient };
  } catch (err) {
    console.error('[EmailService] Relay error:', err.message);
    return { sent: false, method: 'dashboard_only', recipient };
  }
}

module.exports = {
  sendAppointmentEmail
};
