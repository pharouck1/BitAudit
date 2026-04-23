import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : process.env.RENDER_DISK_ROOT
    ? path.join(process.env.RENDER_DISK_ROOT, 'data')
    : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'reports.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const PORT = process.env.PORT || 3001;
const REPORT_TO_EMAIL = process.env.REPORT_TO_EMAIL || 'puzzlemind89@gmail.com';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

function isMailConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && REPORT_TO_EMAIL);
}

function createMailTransporter() {
  if (!isMailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function ensureJsonFile(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '[]\n', 'utf8');
  }
}

async function readCollection(filePath) {
  await ensureJsonFile(filePath);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeCollection(filePath, items) {
  await fs.writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

async function readReports() {
  return readCollection(DATA_FILE);
}

async function writeReports(reports) {
  return writeCollection(DATA_FILE, reports);
}

async function readReviews() {
  return readCollection(REVIEWS_FILE);
}

async function writeReviews(reviews) {
  return writeCollection(REVIEWS_FILE, reviews);
}

async function getStorageSummary() {
  const [reports, reviews] = await Promise.all([readReports(), readReviews()]);

  return {
    dataDirectory: DATA_DIR,
    reportsCount: reports.length,
    reviewsCount: reviews.length,
    persistentDiskConfigured: Boolean(process.env.DATA_DIR || process.env.RENDER_DISK_ROOT),
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function getAdminKey(req) {
  return req.headers['x-admin-key'];
}

function isAuthorizedAdmin(req) {
  return Boolean(ADMIN_KEY) && getAdminKey(req) === ADMIN_KEY;
}

function collectJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) {
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', reject);
  });
}

function validateReportInput(input) {
  const platform = String(input.platform || '').trim();
  const walletType = String(input.walletType || '').trim();
  const totalAssetValue = String(input.totalAssetValue || '').trim();
  const transactionIds = String(input.transactionIds || '').trim();
  const incidentDetails = String(input.incidentDetails || '').trim();
  const contactEmail = String(input.contactEmail || '').trim();
  const contactPhone = String(input.contactPhone || '').trim();
  const screenshot = input.screenshot ?? null;

  if (
    !platform ||
    !walletType ||
    !totalAssetValue ||
    !transactionIds ||
    !incidentDetails ||
    !contactEmail ||
    !contactPhone
  ) {
    return { ok: false, message: 'All fields are required.' };
  }

  if (screenshot && screenshot.dataUrl) {
    if (!String(screenshot.type || '').startsWith('image/')) {
      return { ok: false, message: 'Screenshot must be an image file.' };
    }

    if (!String(screenshot.dataUrl).startsWith('data:image/')) {
      return { ok: false, message: 'Screenshot format is invalid.' };
    }
  }

  return {
    ok: true,
    value: {
      platform,
      walletType,
      totalAssetValue,
      transactionIds,
      incidentDetails,
      contactEmail,
      contactPhone,
      screenshot: screenshot && screenshot.dataUrl
        ? {
            name: String(screenshot.name || 'screenshot'),
            type: String(screenshot.type || 'application/octet-stream'),
            size: Number(screenshot.size || 0),
            dataUrl: String(screenshot.dataUrl || ''),
          }
        : null,
    },
  };
}

function validateReviewInput(input) {
  const reviewRating = Number.parseInt(input.reviewRating, 10);
  const reviewComment = String(input.reviewComment || '').trim();

  if (!Number.isInteger(reviewRating) || reviewRating < 1 || reviewRating > 5) {
    return { ok: false, message: 'Review rating must be between 1 and 5 stars.' };
  }

  return {
    ok: true,
    value: {
      reviewRating,
      reviewComment,
    },
  };
}

function formatReportEmail(report) {
  return [
    'A new incident report has been submitted.',
    '',
    `Report ID: ${report.id}`,
    `Submitted at: ${report.createdAt}`,
    `Reporter email: ${report.contactEmail}`,
    `Reporter phone: ${report.contactPhone}`,
    `Platform: ${report.platform}`,
    `Wallet type: ${report.walletType}`,
    `Total asset value: ${report.totalAssetValue}`,
    `Transaction ID (TXIDs): ${report.transactionIds}`,
    `Screenshot attached: ${report.screenshot ? `Yes (${report.screenshot.name})` : 'No'}`,
    '',
    'Incident details:',
    report.incidentDetails,
  ].join('\n');
}

function formatReviewEmail(review) {
  return [
    'A new customer review has been submitted.',
    '',
    `Review ID: ${review.id}`,
    `Submitted at: ${review.createdAt}`,
    `Rating: ${review.reviewRating}/5`,
    '',
    'Comment:',
    review.reviewComment || 'No comment provided.',
  ].join('\n');
}

async function sendMail({ subject, text, replyTo }) {
  const transporter = createMailTransporter();

  if (!transporter) {
    console.warn('SMTP email skipped: missing SMTP environment variables.');
    return { sent: false, skipped: true };
  }

  await transporter.sendMail({
    from: SMTP_USER,
    to: REPORT_TO_EMAIL,
    replyTo,
    subject,
    text,
  });

  return { sent: true };
}

function createAttachmentFromScreenshot(screenshot) {
  if (!screenshot?.dataUrl) {
    return [];
  }

  const match = screenshot.dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return [];
  }

  return [
    {
      filename: screenshot.name,
      content: match[2],
      encoding: 'base64',
      contentType: screenshot.type,
    },
  ];
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    try {
      const storage = await getStorageSummary();
      sendJson(res, 200, {
        status: 'ok',
        message: 'Backend server is running.',
        endpoints: ['/api/health', '/api/reports', '/api/reviews', '/api/admin/submissions'],
        storage,
      });
    } catch (error) {
      sendJson(res, 500, {
        status: 'error',
        message: 'Backend server is running, but storage could not be read.',
        error: error.message,
      });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    try {
      const storage = await getStorageSummary();
      sendJson(res, 200, { status: 'ok', storage });
    } catch (error) {
      sendJson(res, 500, { status: 'error', message: 'Unable to read storage.', error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/submissions') {
    if (!isAuthorizedAdmin(req)) {
      sendJson(res, 401, { message: 'Unauthorized.' });
      return;
    }

    try {
      const [reports, reviews] = await Promise.all([readReports(), readReviews()]);
      sendJson(res, 200, { reports, reviews });
    } catch (error) {
      sendJson(res, 500, { message: 'Unable to load submissions.', error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/reports') {
    try {
      const payload = await collectJsonBody(req);
      const validated = validateReportInput(payload);

      if (!validated.ok) {
        sendJson(res, 400, { message: validated.message });
        return;
      }

      const reports = await readReports();
      const newReport = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...validated.value,
      };

      reports.unshift({
        ...newReport,
        screenshot: newReport.screenshot
          ? {
              name: newReport.screenshot.name,
              type: newReport.screenshot.type,
              size: newReport.screenshot.size,
            }
          : null,
      });
      await writeReports(reports);

      const transporter = createMailTransporter();
      let email;

      if (!transporter) {
        console.warn('SMTP email skipped: missing SMTP environment variables.');
        email = { sent: false, skipped: true };
      } else {
        await transporter.sendMail({
          from: SMTP_USER,
          to: REPORT_TO_EMAIL,
          replyTo: newReport.contactEmail,
          subject: `New crypto incident report (${newReport.platform})`,
          text: formatReportEmail(newReport),
          attachments: createAttachmentFromScreenshot(newReport.screenshot),
        });
        email = { sent: true };
      }

      sendJson(res, 201, {
        message: 'Report submitted successfully.',
        report: {
          ...newReport,
          screenshot: newReport.screenshot
            ? {
                name: newReport.screenshot.name,
                type: newReport.screenshot.type,
                size: newReport.screenshot.size,
              }
            : null,
        },
        email,
      });
    } catch (error) {
      sendJson(res, 500, { message: 'Unable to save report.', error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/reviews') {
    try {
      const payload = await collectJsonBody(req);
      const validated = validateReviewInput(payload);

      if (!validated.ok) {
        sendJson(res, 400, { message: validated.message });
        return;
      }

      const reviews = await readReviews();
      const newReview = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...validated.value,
      };

      reviews.unshift(newReview);
      await writeReviews(reviews);

      const email = await sendMail({
        subject: `New customer review (${newReview.reviewRating}/5)`,
        text: formatReviewEmail(newReview),
      });

      sendJson(res, 201, {
        message: 'Review submitted successfully.',
        review: newReview,
        email,
      });
    } catch (error) {
      sendJson(res, 500, { message: 'Unable to save review.', error: error.message });
    }
    return;
  }

  sendJson(res, 404, { message: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
  console.log(`Submission data directory: ${DATA_DIR}`);
});
