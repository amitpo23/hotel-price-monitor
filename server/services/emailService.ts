import nodemailer from "nodemailer";
import * as db from "../db";
import { generateExcelReport } from "../utils/excelExport";

interface EmailConfig {
  recipient: string;
  subject: string;
  scanId: number;
}

/**
 * Create email transporter
 * Uses Gmail SMTP - requires app password
 */
function createTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    throw new Error("Email configuration missing: GMAIL_USER and GMAIL_APP_PASSWORD required");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
}

/**
 * Generate HTML email body with scan summary
 */
async function generateEmailBody(scanId: number): Promise<string> {
  const scan = await db.getScanById(scanId);
  if (!scan) {
    throw new Error("Scan not found");
  }

  const config = await db.getScanConfigById(scan.scanConfigId);
  if (!config) {
    throw new Error("Scan configuration not found");
  }

  const results = await db.getScanResults(scanId);
  const hotels = await db.getHotelsForScanConfig(scan.scanConfigId);

  // Calculate statistics
  const totalResults = results.length;
  const availableResults = results.filter((r) => r.isAvailable).length;
  const avgPrice =
    results
      .filter((r) => r.price !== null)
      .reduce((sum, r) => sum + (r.price || 0), 0) / availableResults || 0;

  const hotelNames = hotels.map((h) => h.name).join(", ");

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #2563eb;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .stat {
      background-color: white;
      padding: 15px;
      margin: 10px 0;
      border-radius: 6px;
      border-left: 4px solid #2563eb;
    }
    .stat-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
      margin-top: 5px;
    }
    .footer {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏨 Hotel Price Scan Report</h1>
    <p>Scan ID: ${scanId} | ${new Date().toLocaleDateString()}</p>
  </div>
  
  <div class="content">
    <h2>Scan Summary</h2>
    <p><strong>Configuration:</strong> ${config.name}</p>
    <p><strong>Hotels Scanned:</strong> ${hotelNames}</p>
    <p><strong>Date Range:</strong> ${config.daysForward} days forward</p>
    
    <div class="stat">
      <div class="stat-label">Total Price Points</div>
      <div class="stat-value">${totalResults}</div>
    </div>
    
    <div class="stat">
      <div class="stat-label">Available Rooms</div>
      <div class="stat-value">${availableResults} / ${totalResults}</div>
    </div>
    
    <div class="stat">
      <div class="stat-label">Average Price</div>
      <div class="stat-value">₪${(avgPrice / 100).toFixed(2)}</div>
    </div>
    
    <p style="margin-top: 20px;">
      <strong>📎 Attached:</strong> Detailed Excel report with all pricing data
    </p>
    
    <p style="margin-top: 20px; padding: 15px; background-color: #dbeafe; border-radius: 6px;">
      💡 <strong>Tip:</strong> Open the attached Excel file to view detailed price comparisons, 
      trends, and recommendations for each hotel and date.
    </p>
  </div>
  
  <div class="footer">
    <p>This is an automated report from Hotel Price Monitor</p>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
  `;
}

/**
 * Send scan report email with Excel attachment
 */
export async function sendScanReport(config: EmailConfig): Promise<boolean> {
  try {
    console.log(`[EmailService] Preparing to send report for scan ${config.scanId}`);

    // Generate Excel report
    const scan = await db.getScanById(config.scanId);
    if (!scan) {
      throw new Error("Scan not found");
    }
    
    const excelBuffer = await generateExcelReport({
      scanId: config.scanId,
      scanConfigId: scan.scanConfigId,
    });
    
    // Generate email body
    const htmlBody = await generateEmailBody(config.scanId);

    // Create transporter
    const transporter = createTransporter();

    // Send email
    const info = await transporter.sendMail({
      from: `"Hotel Price Monitor" <${process.env.GMAIL_USER}>`,
      to: config.recipient,
      subject: config.subject || `Hotel Price Scan Report - ${new Date().toLocaleDateString()}`,
      html: htmlBody,
      attachments: [
        {
          filename: `hotel-prices-${config.scanId}-${Date.now()}.xlsx`,
          content: excelBuffer,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    console.log(`[EmailService] Email sent successfully: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`[EmailService] Failed to send email:`, error);
    return false;
  }
}

/**
 * Send scan report to default recipient (from env or config)
 */
export async function sendScanReportAuto(scanId: number): Promise<boolean> {
  const defaultRecipient = process.env.DEFAULT_REPORT_EMAIL;

  if (!defaultRecipient) {
    console.warn('[EmailService] DEFAULT_REPORT_EMAIL not configured, skipping automatic email report');
    return false;
  }

  return sendScanReport({
    scanId,
    recipient: defaultRecipient,
    subject: `Daily Hotel Price Report - ${new Date().toLocaleDateString()}`,
  });
}
