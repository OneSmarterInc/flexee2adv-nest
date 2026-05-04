import nodemailer from "nodemailer";
import dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";

dotenv.config();

/* -------------------------------------------
   TITAN EMAIL TRANSPORTER (GoDaddy)
-------------------------------------------- */

const transporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true,
  auth: {
    user: "wecare@zynk.co.in",
    pass: process.env.TITAN_PASSWORD,
  },
});

/* -------------------------------------------
   UTILITY FUNCTIONS
-------------------------------------------- */

export function generateRandomPassword(length = 8): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

export function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/* -------------------------------------------
   EMAIL UI WRAPPER (REUSABLE LAYOUT)
-------------------------------------------- */

function emailWrapper(content: string) {
  return `
  <div style="background:#f4f4f4;padding:40px 0;font-family:Arial, sans-serif;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:12px;padding:30px;
                box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      ${content}
    </div>

    <p style="text-align:center;color:#999;font-size:12px;margin-top:20px;">
      © 2025 ZYNK · All Rights Reserved ·
      <a href="https://zynk.co.in" style="color:#FFD600;text-decoration:none;">zynk.co.in</a>
    </p>
  </div>
  `;
}

/* -------------------------------------------
   SEND OTP EMAIL
-------------------------------------------- */

export async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  const content = `
    <h2 style="color:#FFD600;">Your Verification Code</h2>
    <p>Hello,</p>
    <p>Please use the OTP below to verify your identity:</p>

    <div style="background:#FFD600;color:#000;font-size:32px;font-weight:bold;
                padding:15px;border-radius:10px;text-align:center;
                letter-spacing:5px;margin:20px 0;">
      ${otp}
    </div>

    <p>This OTP is valid for a limited time. Do not share it with anyone.</p>
  `;

  await transporter.sendMail({
    from: "ZYNK Care <wecare@zynk.co.in>",
    to: email,
    subject: "Your ZYNK OTP Code",
    html: emailWrapper(content),
  });

  return true;
}

/* -------------------------------------------
   ORDER CONFIRMATION EMAIL
-------------------------------------------- */

export async function sendOrderConfirmationEmail(
  email: string,
  orderId: string,
  orderDate: string,
  totalAmount: number
): Promise<boolean> {
  const content = `
    <h2 style="color:#FFD600;">Order Confirmed!</h2>
    <p>Thank you for your purchase at <strong>ZYNK</strong>.</p>

    <div style="margin-top:20px;">
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Order Date:</strong> ${orderDate}</p>
      <p><strong>Total Amount:</strong> ₹${totalAmount.toFixed(2)}</p>
    </div>

    <div style="background:#fafafa;padding:20px;border-radius:10px;margin-top:20px;">
      <p>Your order has been successfully placed. You will receive an update once it ships.</p>
    </div>

    <p style="margin-top:25px;">For support, contact us at 
      <a href="mailto:wecare@zynk.co.in" style="color:#FFD600;text-decoration:none;">
        wecare@zynk.co.in
      </a>
    </p>
  `;

  await transporter.sendMail({
    from: "ZYNK Care <wecare@zynk.co.in>",
    to: email,
    subject: "Your Order is Confirmed – ZYNK",
    html: emailWrapper(content),
  });

  return true;
}

/* -------------------------------------------
   PASSWORD RESET EMAIL (AUTO GENERATED)
-------------------------------------------- */

export async function sendPasswordResetEmail(
  email: string,
  newPassword: string
): Promise<boolean> {
  const content = `
    <h2 style="color:#FFD600;">Password Reset Successful</h2>
    <p>Your new password has been generated:</p>

    <div style="background:#000;color:#FFD600;font-size:22px;font-weight:bold;
                padding:12px;border-radius:10px;text-align:center;
                letter-spacing:3px;margin:20px 0;">
      ${newPassword}
    </div>

    <p>Please log in and change this password immediately for security.</p>
  `;

  await transporter.sendMail({
    from: "ZYNK Care <wecare@zynk.co.in>",
    to: email,
    subject: "Your New Password – ZYNK",
    html: emailWrapper(content),
  });

  return true;
}

/* -------------------------------------------
   TEMPORARY PASSWORD EMAIL
-------------------------------------------- */

export async function sendTempPasswordEmail(
  email: string,
  tempPassword: string
): Promise<boolean> {
  const content = `
    <h2 style="color:#FFD600;">Temporary Login Password</h2>
    <p>Use the temporary password below:</p>

    <div style="background:#FFD600;color:#000;font-size:26px;padding:12px;
                border-radius:10px;text-align:center;font-weight:bold;
                letter-spacing:3px;margin:20px 0;">
      ${tempPassword}
    </div>

    <p>Please update your password immediately after logging in.</p>
  `;

  await transporter.sendMail({
    from: "ZYNK Care <wecare@zynk.co.in>",
    to: email,
    subject: "Your Temporary Password – ZYNK",
    html: emailWrapper(content),
  });

  return true;
}

/* -------------------------------------------
   FORGOT PASSWORD FLOW
-------------------------------------------- */

export async function forgetPassword(email: string): Promise<string | false> {
  try {
    const newPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const content = `
      <h2 style="color:#FFD600;">Password Reset</h2>
      <p>Your new password is below:</p>

      <div style="background:#000;color:#FFD600;font-size:24px;font-weight:bold;
                  padding:12px;border-radius:10px;text-align:center;
                  letter-spacing:3px;margin:20px 0;">
        ${newPassword}
      </div>

      <p>Please log in and change your password immediately.</p>
    `;

    await transporter.sendMail({
      from: "ZYNK Care <wecare@zynk.co.in>",
      to: email,
      subject: "Your New Password – ZYNK",
      html: emailWrapper(content),
    });

    return hashedPassword;
  } catch (error: any) {
    console.error("Error in forgetPassword:", error.message);
    return false;
  }
}
