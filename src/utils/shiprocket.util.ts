import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();
let shiprocketToken: string | null = null;
let shiprocketTokenExpiry: number | null = null; // timestamp in ms
let tokenPromise: Promise<string> | null = null; // prevents concurrent login calls

const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;
const SHIPROCKET_BASE_URL =
  process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';

// New: helper to check required envs
export function checkShiprocketEnv() {
  const missing: string[] = [];
  if (!SHIPROCKET_EMAIL) missing.push('SHIPROCKET_EMAIL');
  if (!SHIPROCKET_PASSWORD) missing.push('SHIPROCKET_PASSWORD');
  return { ok: missing.length === 0, missing };
}

// log at startup for visibility
const envCheck = checkShiprocketEnv();
if (!envCheck.ok) {
  console.warn(
    `Shiprocket env variables missing: ${envCheck.missing.join(
      ', ',
    )}. Shiprocket calls will fail until these are set.`,
  );
}

async function fetchNewToken(): Promise<string> {
  try {
    const response = await axios.post(
      `${SHIPROCKET_BASE_URL}/auth/login`,
      { email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      },
    );

    const token = response?.data?.token;
    if (!token) {
      throw new Error('No token returned from Shiprocket login');
    }

    const now = Date.now();
    shiprocketToken = token;
    // Cache for 9.5 days (slightly less than 10-day validity)
    shiprocketTokenExpiry = now + 9.5 * 24 * 60 * 60 * 1000;

    console.log('✅ Shiprocket token refreshed successfully.');
    return token;
  } catch (err: any) {
    console.error('❌ Failed to fetch Shiprocket token:', err?.response?.data || err.message);
    throw new Error('Shiprocket authentication failed.');
  }
}

export async function getShiprocketToken(): Promise<string> {
  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
    throw new Error(
      'Shiprocket credentials missing. Please set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in environment variables.',
    );
  }

  const now = Date.now();

  // ✅ Return cached token if still valid
  if (shiprocketToken && shiprocketTokenExpiry && now < shiprocketTokenExpiry) {
    return shiprocketToken;
  }

  // ✅ If another request is already fetching, wait for it
  if (tokenPromise) {
    return tokenPromise;
  }

  // ✅ Start token fetch (ensures only one active request)
  tokenPromise = fetchNewToken();

  try {
    const token = await tokenPromise;
    return token;
  } finally {
    tokenPromise = null; // reset once resolved/rejected
  }
}

export default getShiprocketToken;
