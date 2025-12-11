import nodemailer from 'nodemailer';

const SENDER_EMAIL = "srisharan.psgtech@gmail.com";

function createTransporter() {
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpUser = process.env.SMTP_USER || SENDER_EMAIL;
  
  if (!smtpPassword || smtpPassword.trim() === "") {
    console.warn("SMTP_PASSWORD not set. Email sending will be disabled.");
    return null;
  }

  try {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      requireTLS: true,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  } catch (error) {
    console.error("Failed to create email transporter:", error);
    return null;
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log("Email not sent - SMTP not configured. Would send to:", to);
      console.log("Subject:", subject);
      return;
    }

    const mailOptions = {
      from: SENDER_EMAIL,
      to: to,
      subject: subject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export async function sendApprovalRequestNotification(
  approverEmail: string,
  requesterUsername: string,
  commandText: string,
  requestId: string
): Promise<void> {
  const subject = `New Approval Request: ${commandText}`;
  const html = `
    <html>
      <body>
        <h2>New Approval Request</h2>
        <p>A new command approval request has been submitted.</p>
        <p><strong>Requester:</strong> ${requesterUsername}</p>
        <p><strong>Command:</strong> <code>${commandText}</code></p>
        <p><strong>Request ID:</strong> ${requestId}</p>
        <p>Please review and approve or reject this request in the approver dashboard.</p>
      </body>
    </html>
  `;
  
  await sendEmail(approverEmail, subject, html);
}

