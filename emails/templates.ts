/**
 * Rich HTML email templates for Pharmegic Healthcare Portal
 */

const baseLayout = (title: string, bodyContent: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 30px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }
    .header {
      background-color: #064e3b;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 35px 30px;
      line-height: 1.6;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .btn {
      background-color: #10b981;
      color: #ffffff !important;
      padding: 12px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      display: inline-block;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
    }
    .btn:hover {
      background-color: #059669;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .accent {
      color: #064e3b;
      font-weight: 600;
    }
    .card {
      background-color: #f8fafc;
      border-left: 4px solid #064e3b;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 0 6px 6px 0;
    }
    .card-title {
      font-weight: 700;
      margin-bottom: 5px;
      color: #0f172a;
    }
    .text-muted {
      color: #64748b;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>PHARMEGIC HEALTHCARE</h1>
      </div>
      <div class="content">
        ${bodyContent}
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Pharmegic Healthcare. All rights reserved.</p>
        <p>This is an automated operational transmission. Please do not reply directly to this mailbox.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const getInvitationEmail = (companyName: string, inviteUrl: string, setupToken: string) => {
  return baseLayout(
    'Welcome to Pharmegic Healthcare Portal',
    `
    <p>Dear Administrator / Representative,</p>
    <p>We are pleased to inform you that your company, <span class="accent">${companyName}</span>, has been registered on the <strong>Pharmegic Healthcare Compliance & TCC Management Portal</strong>.</p>
    <p>You have been assigned as the primary owner for your organization's dashboard. To complete your setup and configure your secure credentials, please click the link below:</p>
    <div class="button-container">
      <a href="${inviteUrl}" class="btn">Configure Account Password</a>
    </div>
    <p>If the button above does not work, copy and paste the following URL into your browser:</p>
    <p class="text-muted">${inviteUrl}</p>
    <p>Please note that this invitation link is secure and will expire in 48 hours for compliance safety.</p>
    <p>Best regards,<br>Pharmegic Healthcare Compliance Team</p>
    `
  );
};

export const getPasswordResetEmail = (resetUrl: string) => {
  return baseLayout(
    'Reset Password — Pharmegic Healthcare',
    `
    <p>Hello,</p>
    <p>We received a request to reset the password for your account on the <strong>Pharmegic Healthcare Portal</strong>.</p>
    <p>You can reset your password by clicking the button below:</p>
    <div class="button-container">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>
    <p>If you did not request a password reset, you can safely ignore this email. Your current credentials remain secure.</p>
    <p>Best regards,<br>Pharmegic Healthcare IT Support</p>
    `
  );
};

export const getTccApprovalEmail = (companyName: string, chemicalName: string, certNumber: string, downloadUrl: string) => {
  return baseLayout(
    'TCC Application Approved',
    `
    <p>Dear Compliance Officer,</p>
    <p>We are pleased to inform you that your Tonnage Compliance Certificate (TCC) application for <span class="accent">${chemicalName}</span> has been <strong>Approved</strong>.</p>
    <div class="card">
      <div class="card-title">Certificate Details</div>
      <div><strong>Company Name:</strong> ${companyName}</div>
      <div><strong>Substance:</strong> ${chemicalName}</div>
      <div><strong>Certificate Number:</strong> ${certNumber}</div>
      <div><strong>Status:</strong> Approved & Active</div>
    </div>
    <p>Your official TCC certificate has been generated. You can download the PDF document directly from your client dashboard or by clicking the link below:</p>
    <div class="button-container">
      <a href="${downloadUrl}" class="btn">Download TCC Certificate PDF</a>
    </div>
    <p>Please note that all future shipments must align with the authorized limits on the certificate.</p>
    <p>Best regards,<br>Pharmegic Healthcare Compliance Office</p>
    `
  );
};

export const getTccRejectionEmail = (companyName: string, chemicalName: string, reason: string) => {
  return baseLayout(
    'TCC Application Action Required',
    `
    <p>Dear Compliance Officer,</p>
    <p>We regret to inform you that your recent Tonnage Compliance Certificate (TCC) application for <span class="accent">${chemicalName}</span> has been reviewed and requires modification/clarification.</p>
    <div class="card">
      <div class="card-title">Rejection / Review Comments</div>
      <p style="margin: 0; font-style: italic; color: #b91c1c;">"${reason}"</p>
    </div>
    <p>You may resubmit your application through your dashboard after making the necessary changes requested by the administrator.</p>
    <p>If you have any questions, please contact the compliance officer listed on your support panel.</p>
    <p>Best regards,<br>Pharmegic Healthcare Compliance Office</p>
    `
  );
};

export const getRenewalReminderEmail = (companyName: string, chemicalName: string, validityDate: string) => {
  return baseLayout(
    'URGENT: TCC Certificate Renewal Reminder',
    `
    <p>Dear Compliance Officer,</p>
    <p>This is an automated notification that your Tonnage Compliance Certificate (TCC) authorization for <span class="accent">${chemicalName}</span> is approaching its validity limit.</p>
    <div class="card">
      <div class="card-title">Validity Status</div>
      <div><strong>Company Name:</strong> ${companyName}</div>
      <div><strong>Substance:</strong> ${chemicalName}</div>
      <div><strong>Validity Date:</strong> ${validityDate}</div>
      <div style="color: #b45309; font-weight: 600;">Action Required: Renewal Pending</div>
    </div>
    <p>To avoid disruptions in chemical exports, please initiate a new application or submit a renewal request before the expiry date.</p>
    <p>Best regards,<br>Pharmegic Healthcare Compliance Team</p>
    `
  );
};

export const getNotificationEmail = (title: string, message: string) => {
  return baseLayout(
    title,
    `
    <p>Hello,</p>
    <p>You have a new update in your <strong>Pharmegic Healthcare Portal</strong>:</p>
    <div class="card">
      <div class="card-title">${title}</div>
      <p style="margin: 0;">${message}</p>
    </div>
    <p>Please log in to your dashboard to view the full details.</p>
    <p>Best regards,<br>Pharmegic Healthcare Support</p>
    `
  );
};
