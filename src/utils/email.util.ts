import Mailjet from "node-mailjet";
import dotenv from "dotenv";

dotenv.config();

/* -------------------------------------------
   MAILJET INITIALIZATION
-------------------------------------------- */

const API_KEY = process.env.MAILJET_API_KEY;
const API_SECRET = process.env.MAILJET_API_SECRET;
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS;
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "FLEXEE";

if (!API_KEY || !API_SECRET) {
  console.warn(
    "⚠️  WARNING: Mailjet API credentials not configured. Set MAILJET_API_KEY and MAILJET_API_SECRET environment variables."
  );
}

if (!MAIL_FROM_ADDRESS) {
  console.warn(
    "⚠️  WARNING: Sender email not configured. Set MAIL_FROM_ADDRESS environment variable to a verified Mailjet sender email."
  );
}

const mailjet = Mailjet.apiConnect(API_KEY || "", API_SECRET || "");

/* -------------------------------------------
   EMAIL UI WRAPPER (REUSABLE LAYOUT)
   Corporate Edition palette — blue primary,
   emerald for progression signals, amber for
   time-sensitive prompts.
-------------------------------------------- */

const BRAND = {
  bgPage:       "#F3F4F6",   // neutral page background
  bgSurface:    "#FFFFFF",
  bgElevated:   "#F9FAFB",
  border:       "#E5E7EB",
  textPrimary:  "#111827",
  textMuted:    "#6B7280",
  accent:       "#1D4ED8",   // blue-700 — matches the admin UI
  accentHover:  "#1E40AF",   // blue-800
  accentLight:  "#EFF6FF",
  accent2:      "#065F46",   // emerald-800 — progression / module unlocks
  accent3:      "#92400E",   // amber-800 — quarter deadlines
};

function emailWrapper(content: string) {
  return `
  <div style="background:${BRAND.bgPage};padding:40px 16px;
              font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
              color:${BRAND.textPrimary};">
    <div style="max-width:600px;margin:0 auto;background:${BRAND.bgSurface};
                border:1px solid ${BRAND.border};border-radius:14px;padding:36px 32px;
                box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      ${content}
    </div>

    <div style="max-width:600px;margin:24px auto 0;text-align:center;">
      <p style="color:${BRAND.textMuted};font-size:12px;margin:0 0 4px;
                font-family:'Inter',Arial,sans-serif;">
        © 2026 FLEXEE Corporate Edition · One Smarter Inc.
      </p>
      <p style="color:${BRAND.textMuted};font-size:12px;margin:0;
                font-family:'Inter',Arial,sans-serif;">
        <a href="https://flexee.onesmarter.com"
           style="color:${BRAND.accent};text-decoration:none;font-weight:500;">
          flexee.onesmarter.com
        </a>
      </p>
    </div>
  </div>
  `;
}

/* -------------------------------------------
   SEND EMAIL VIA MAILJET
-------------------------------------------- */

async function sendEmailViaMailjet(
  toEmail: string,
  toName: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  if (!MAIL_FROM_ADDRESS) {
    console.error(
      "✗ Cannot send email: MAIL_FROM_ADDRESS environment variable not set. Configure a verified Mailjet sender email."
    );
    return false;
  }

  if (!API_KEY || !API_SECRET) {
    console.error(
      "✗ Cannot send email: Mailjet API credentials not configured. Set MAILJET_API_KEY and MAILJET_API_SECRET."
    );
    return false;
  }

  try {
    const request = mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: MAIL_FROM_ADDRESS,
            Name: MAIL_FROM_NAME,
          },
          To: [
            {
              Email: toEmail,
              Name: toName,
            },
          ],
          Subject: subject,
          HTMLPart: htmlContent,
          TrackOpens: "enabled",
          TrackClicks: "enabled",
        },
      ],
    });

    const response = await request;
    const responseBody = response?.body as any;

    console.log("Mailjet Response - Body Type:", typeof responseBody);
    console.log("Mailjet Response - Has Messages:", !!responseBody?.Messages);

    if (responseBody?.Messages && responseBody.Messages[0]) {
      const message = responseBody.Messages[0];
      console.log("Message Status:", message.Status);

      if (message.Status === "success") {
        const recipient = message.To?.[0];
        const messageId = recipient?.MessageID;
        const messageUuid = recipient?.MessageUUID;
        const messageHref = recipient?.MessageHref;

        console.log(`✓ Email accepted by Mailjet for ${toEmail}`);
        console.log(`  From: ${MAIL_FROM_ADDRESS}`);
        console.log(`  MessageID:   ${messageId}`);
        console.log(`  MessageUUID: ${messageUuid}`);
        console.log(`  Lookup URL:  ${messageHref}`);
        return true;
      } else {
        console.error(`✗ Email delivery failed with status: ${message.Status}`);
        console.error("  From:", MAIL_FROM_ADDRESS);
        console.error("  To:", toEmail);
        console.error("  Errors:", message.Errors);
        return false;
      }
    }

    console.error("✗ Failed to send email via Mailjet - No Messages in response");
    console.error("  From:", MAIL_FROM_ADDRESS);
    console.error("  To:", toEmail);
    console.error("  Response body:", responseBody);
    return false;
  } catch (error: any) {
    console.error("✗ Error sending email via Mailjet:", error?.message || error);
    console.error("  From:", MAIL_FROM_ADDRESS);
    console.error("  To:", toEmail);
    if (error?.response?.body) {
      console.error("  Error details:", error.response.body);
      console.error("  ** This usually means one of:");
      console.error("     1) Sender email is not verified in Mailjet");
      console.error("     2) API credentials are invalid or expired");
      console.error("     3) SPF/DKIM records are not configured");
    }
    return false;
  }
}

/* -------------------------------------------
   PARTICIPANT SIMULATION INVITE EMAIL
-------------------------------------------- */

export async function sendParticipantInviteEmail(
  email: string,
  simulationName: string,
  inviteLink: string,
  customMessage?: string,
  options?: {
    firmName?: string;       // Pre-assigned firm name, if any
    firmNumber?: number;     // Pre-assigned firm number, if any
    invitedByName?: string;  // Facilitator member who sent the invite
    expiresAt?: Date;        // Invite expiry — drives the deadline copy
  }
): Promise<boolean> {
  const hasFirmAssignment = options?.firmName || options?.firmNumber;
  const firmLabel = options?.firmName
    ? options.firmName
    : options?.firmNumber
    ? `Firm ${options.firmNumber}`
    : null;

  const expiryCopy = options?.expiresAt
    ? `This invite expires on ${options.expiresAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}.`
    : null;

  const content = `
    <!-- Edition tag -->
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;padding:6px 14px;
                   background:${BRAND.accentLight};
                   border:1px solid ${BRAND.border};
                   border-radius:999px;
                   font-size:11px;font-weight:700;
                   color:${BRAND.accent};
                   letter-spacing:0.08em;
                   font-family:'Inter',Arial,sans-serif;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;
                     background:${BRAND.accent};margin-right:6px;
                     vertical-align:middle;"></span>
        CORPORATE EDITION
      </span>
    </div>

    <!-- Headline -->
    <h1 style="font-size:26px;font-weight:800;line-height:1.2;
               margin:0 0 14px;letter-spacing:-0.02em;
               color:${BRAND.textPrimary};text-align:center;
               font-family:'Inter',Arial,sans-serif;">
      You're invited to
      <span style="color:${BRAND.accent};">${simulationName}</span>
    </h1>

    <p style="font-size:15px;line-height:1.65;color:${BRAND.textMuted};
              margin:0 0 28px;text-align:center;
              font-family:'Inter',Arial,sans-serif;">
      ${options?.invitedByName
        ? `${options.invitedByName} has added you to a FLEXEE supply chain simulation.`
        : `Your instructor has added you to a FLEXEE supply chain simulation.`}
      ${hasFirmAssignment
        ? `You'll be running <strong style="color:${BRAND.textPrimary};">${firmLabel}</strong> with your team.`
        : `You'll pick a firm after accepting.`}
    </p>

    ${customMessage ? `
      <div style="background:${BRAND.bgElevated};
                  border-left:3px solid ${BRAND.accent};
                  border-radius:6px;
                  padding:16px 18px;
                  margin:0 0 28px;">
        <div style="font-size:10px;font-weight:700;
                    color:${BRAND.accent};letter-spacing:0.08em;
                    margin-bottom:6px;
                    font-family:'Inter',Arial,sans-serif;">
          A NOTE FROM YOUR INSTRUCTOR
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;
                  color:${BRAND.textPrimary};
                  font-family:'Inter',Arial,sans-serif;">
          ${customMessage}
        </p>
      </div>
    ` : ''}

    <!-- Primary CTA -->
    <div style="text-align:center;margin:32px 0 16px;">
      <a href="${inviteLink}"
         style="display:inline-block;
                background:${BRAND.accent};color:#FFFFFF;
                padding:14px 36px;
                border-radius:9px;
                text-decoration:none;
                font-weight:700;font-size:14px;
                letter-spacing:0.01em;
                font-family:'Inter',Arial,sans-serif;
                box-shadow:0 1px 3px rgba(29,78,216,0.25);">
        Accept invitation
      </a>
    </div>

    ${expiryCopy ? `
      <p style="text-align:center;font-size:12px;color:${BRAND.accent3};
                margin:0 0 24px;font-weight:600;
                font-family:'Inter',Arial,sans-serif;">
        ${expiryCopy}
      </p>
    ` : '<div style="margin-bottom:24px;"></div>'}

    <!-- Plain link fallback -->
    <p style="font-size:12px;color:${BRAND.textMuted};
              text-align:center;margin:0 0 32px;
              font-family:'Inter',Arial,sans-serif;
              line-height:1.5;">
      Or paste this into your browser:<br>
      <a href="${inviteLink}"
         style="color:${BRAND.accent};word-break:break-all;
                text-decoration:none;">
        ${inviteLink}
      </a>
    </p>

    <!-- How it works — three-step flow -->
    <div style="border-top:1px solid ${BRAND.border};padding-top:24px;">
      <div style="font-size:10px;font-weight:700;
                  color:${BRAND.textMuted};letter-spacing:0.08em;
                  text-align:center;margin-bottom:14px;
                  font-family:'Inter',Arial,sans-serif;">
        HOW THE SIMULATION WORKS
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td width="33%" align="center" style="padding:8px 4px;vertical-align:top;">
            <div style="width:32px;height:32px;border-radius:50%;
                        background:${BRAND.accent3};color:#FFFFFF;
                        line-height:32px;font-weight:800;font-size:13px;
                        margin:0 auto 8px;
                        font-family:'Inter',Arial,sans-serif;">1</div>
            <div style="font-size:12px;font-weight:700;color:${BRAND.textPrimary};
                        margin-bottom:2px;font-family:'Inter',Arial,sans-serif;">
              Make your decisions
            </div>
            <div style="font-size:11px;color:${BRAND.textMuted};line-height:1.4;
                        font-family:'Inter',Arial,sans-serif;">
              Forecast, produce, price, market
            </div>
          </td>
          <td width="33%" align="center" style="padding:8px 4px;vertical-align:top;">
            <div style="width:32px;height:32px;border-radius:50%;
                        background:${BRAND.accent};color:#FFFFFF;
                        line-height:32px;font-weight:800;font-size:13px;
                        margin:0 auto 8px;
                        font-family:'Inter',Arial,sans-serif;">2</div>
            <div style="font-size:12px;font-weight:700;color:${BRAND.textPrimary};
                        margin-bottom:2px;font-family:'Inter',Arial,sans-serif;">
              Submit before the deadline
            </div>
            <div style="font-size:11px;color:${BRAND.textMuted};line-height:1.4;
                        font-family:'Inter',Arial,sans-serif;">
              Quarters close on a schedule
            </div>
          </td>
          <td width="33%" align="center" style="padding:8px 4px;vertical-align:top;">
            <div style="width:32px;height:32px;border-radius:50%;
                        background:${BRAND.accent2};color:#FFFFFF;
                        line-height:32px;font-weight:800;font-size:13px;
                        margin:0 auto 8px;
                        font-family:'Inter',Arial,sans-serif;">3</div>
            <div style="font-size:12px;font-weight:700;color:${BRAND.textPrimary};
                        margin-bottom:2px;font-family:'Inter',Arial,sans-serif;">
              See where you stand
            </div>
            <div style="font-size:11px;color:${BRAND.textMuted};line-height:1.4;
                        font-family:'Inter',Arial,sans-serif;">
              Live leaderboard vs. other firms
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- About box -->
    <div style="background:${BRAND.bgElevated};
                border:1px solid ${BRAND.border};
                border-radius:8px;
                padding:14px 16px;
                margin-top:24px;">
      <p style="margin:0;font-size:12px;color:${BRAND.textMuted};
                line-height:1.6;
                font-family:'Inter',Arial,sans-serif;">
        <span style="color:${BRAND.textPrimary};font-weight:700;">About FLEXEE Corporate.</span>
        A multi-quarter supply chain simulation where you compete against other
        firms in the same market. Advanced modules unlock as the simulation
        progresses — VMI, regional DCs, multi-carrier shipping, product
        innovation, and more — adding new decisions on top of the ones you
        already manage.
      </p>
    </div>
  `;

  return sendEmailViaMailjet(
    email,
    email,
    `Invitation: Join ${simulationName} on FLEXEE`,
    emailWrapper(content)
  );
}

/* -------------------------------------------
   QUARTER DEADLINE REMINDER EMAIL
   Optional — fires from the cron/scheduler when
   a quarter is about to close and a firm hasn't
   submitted.
-------------------------------------------- */

export async function sendQuarterDeadlineEmail(
  email: string,
  participantName: string,
  simulationName: string,
  firmName: string,
  quarter: number,
  hoursRemaining: number,
  cockpitLink: string
): Promise<boolean> {
  const urgent = hoursRemaining <= 6;

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;padding:6px 14px;
                   background:${urgent ? '#FEF3C7' : BRAND.accentLight};
                   border:1px solid ${urgent ? '#FCD34D' : BRAND.border};
                   border-radius:999px;
                   font-size:11px;font-weight:700;
                   color:${urgent ? BRAND.accent3 : BRAND.accent};
                   letter-spacing:0.08em;
                   font-family:'Inter',Arial,sans-serif;">
        ${urgent ? '⚠ DEADLINE APPROACHING' : 'QUARTER REMINDER'}
      </span>
    </div>

    <h1 style="font-size:24px;font-weight:800;line-height:1.25;
               margin:0 0 12px;letter-spacing:-0.02em;
               color:${BRAND.textPrimary};text-align:center;
               font-family:'Inter',Arial,sans-serif;">
      Q${quarter} closes in
      <span style="color:${urgent ? BRAND.accent3 : BRAND.accent};">
        ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}
      </span>
    </h1>

    <p style="font-size:14px;line-height:1.65;color:${BRAND.textMuted};
              margin:0 0 28px;text-align:center;
              font-family:'Inter',Arial,sans-serif;">
      ${participantName ? participantName + ', your' : 'Your'} firm
      <strong style="color:${BRAND.textPrimary};">${firmName}</strong>
      in <strong style="color:${BRAND.textPrimary};">${simulationName}</strong>
      hasn't submitted decisions for this quarter yet.
    </p>

    <div style="background:${BRAND.bgElevated};
                border:1px solid ${BRAND.border};
                border-radius:8px;
                padding:14px 16px;
                margin:0 0 28px;">
      <p style="margin:0;font-size:13px;color:${BRAND.textPrimary};
                line-height:1.6;
                font-family:'Inter',Arial,sans-serif;">
        <strong>If you don't submit in time</strong>, your previous quarter's
        decisions carry forward automatically. No penalty — but you miss the
        chance to react to whatever happened last quarter.
      </p>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="${cockpitLink}"
         style="display:inline-block;
                background:${urgent ? BRAND.accent3 : BRAND.accent};color:#FFFFFF;
                padding:14px 36px;
                border-radius:9px;
                text-decoration:none;
                font-weight:700;font-size:14px;
                letter-spacing:0.01em;
                font-family:'Inter',Arial,sans-serif;
                box-shadow:0 1px 3px rgba(29,78,216,0.25);">
        Open the cockpit
      </a>
    </div>

    <p style="font-size:12px;color:${BRAND.textMuted};
              text-align:center;margin:24px 0 0;
              font-family:'Inter',Arial,sans-serif;">
      Or paste this into your browser:<br>
      <a href="${cockpitLink}"
         style="color:${BRAND.accent};word-break:break-all;
                text-decoration:none;">
        ${cockpitLink}
      </a>
    </p>
  `;

  return sendEmailViaMailjet(
    email,
    participantName || email,
    `${urgent ? '⚠ ' : ''}Q${quarter} closes soon — ${simulationName}`,
    emailWrapper(content)
  );
}

/* -------------------------------------------
   MODULE UNLOCK NOTIFICATION EMAIL
   Optional — fires when a scheduled module opens
   for the cohort. Sent to all enrolled participants.
-------------------------------------------- */

export async function sendModuleUnlockedEmail(
  email: string,
  participantName: string,
  simulationName: string,
  moduleLabel: string,
  moduleDescription: string,
  quarter: number,
  cockpitLink: string
): Promise<boolean> {
  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;padding:6px 14px;
                   background:#D1FAE5;
                   border:1px solid #6EE7B7;
                   border-radius:999px;
                   font-size:11px;font-weight:700;
                   color:${BRAND.accent2};
                   letter-spacing:0.08em;
                   font-family:'Inter',Arial,sans-serif;">
        🔓 NEW MODULE UNLOCKED · Q${quarter}
      </span>
    </div>

    <h1 style="font-size:24px;font-weight:800;line-height:1.25;
               margin:0 0 12px;letter-spacing:-0.02em;
               color:${BRAND.textPrimary};text-align:center;
               font-family:'Inter',Arial,sans-serif;">
      <span style="color:${BRAND.accent};">${moduleLabel}</span>
      is now available
    </h1>

    <p style="font-size:14px;line-height:1.65;color:${BRAND.textMuted};
              margin:0 0 24px;text-align:center;
              font-family:'Inter',Arial,sans-serif;">
      ${moduleDescription}
    </p>

    <div style="background:${BRAND.accentLight};
                border-left:3px solid ${BRAND.accent};
                border-radius:6px;
                padding:14px 16px;
                margin:0 0 28px;">
      <p style="margin:0;font-size:13px;color:${BRAND.textPrimary};
                line-height:1.6;
                font-family:'Inter',Arial,sans-serif;">
        New decisions appear in your cockpit starting this quarter. The other
        firms in <strong>${simulationName}</strong> are seeing this at the same
        time — first to use it well wins the round.
      </p>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="${cockpitLink}"
         style="display:inline-block;
                background:${BRAND.accent};color:#FFFFFF;
                padding:14px 36px;
                border-radius:9px;
                text-decoration:none;
                font-weight:700;font-size:14px;
                letter-spacing:0.01em;
                font-family:'Inter',Arial,sans-serif;
                box-shadow:0 1px 3px rgba(29,78,216,0.25);">
        See what's new
      </a>
    </div>
  `;

  return sendEmailViaMailjet(
    email,
    participantName || email,
    `${moduleLabel} unlocked — ${simulationName}`,
    emailWrapper(content)
  );
}
