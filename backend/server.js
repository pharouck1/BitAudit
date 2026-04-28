import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3001;
const REPORT_TO_EMAIL = process.env.REPORT_TO_EMAIL || 'puzzlemind89@gmail.com';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'bitaudit';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let databaseConnectionPromise = null;

const screenshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    type: { type: String, trim: true, required: true },
    size: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    platform: { type: String, trim: true, required: true },
    walletType: { type: String, trim: true, required: true },
    totalAssetValue: { type: String, trim: true, required: true },
    transactionIds: { type: String, trim: true, required: true },
    incidentDetails: { type: String, trim: true, required: true },
    contactEmail: { type: String, trim: true, required: true },
    contactPhone: { type: String, trim: true, required: true },
    screenshot: { type: screenshotSchema, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

const reviewSchema = new mongoose.Schema(
  {
    reviewRating: { type: Number, required: true, min: 1, max: 5 },
    reviewComment: { type: String, trim: true, default: '' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

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

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }

  if (!databaseConnectionPromise) {
    databaseConnectionPromise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB_NAME,
      })
      .catch((error) => {
        databaseConnectionPromise = null;
        throw error;
      });
  }

  await databaseConnectionPromise;
  return mongoose.connection;
}

function normalizeDocument(document) {
  if (!document) {
    return null;
  }

  return {
    ...document,
    id: String(document._id),
    createdAt: document.createdAt instanceof Date ? document.createdAt.toISOString() : document.createdAt,
    _id: undefined,
  };
}

async function readReports() {
  await connectToDatabase();
  const reports = await Report.find().sort({ createdAt: -1 }).lean();
  return reports.map(normalizeDocument);
}

async function readReviews() {
  await connectToDatabase();
  const reviews = await Review.find().sort({ createdAt: -1 }).lean();
  return reviews.map(normalizeDocument);
}

async function createReport(reportInput) {
  await connectToDatabase();
  const createdReport = await Report.create(reportInput);
  return normalizeDocument(createdReport.toObject());
}

async function createReview(reviewInput) {
  await connectToDatabase();
  const createdReview = await Review.create(reviewInput);
  return normalizeDocument(createdReview.toObject());
}

async function deleteReportById(id) {
  await connectToDatabase();
  const deletedReport = await Report.findByIdAndDelete(id).lean();
  return normalizeDocument(deletedReport);
}

async function deleteReviewById(id) {
  await connectToDatabase();
  const deletedReview = await Review.findByIdAndDelete(id).lean();
  return normalizeDocument(deletedReview);
}

async function getStorageSummary() {
  await connectToDatabase();
  const [reportsCount, reviewsCount] = await Promise.all([Report.countDocuments(), Review.countDocuments()]);

  return {
    databaseName: mongoose.connection.name,
    reportsCount,
    reviewsCount,
    provider: 'mongodb',
    connectionReady: mongoose.connection.readyState === 1,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
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

function getSanitizedScreenshot(screenshot) {
  if (!screenshot) {
    return null;
  }

  return {
    name: screenshot.name,
    type: screenshot.type,
    size: screenshot.size,
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

async function sendMail({ subject, text, replyTo, attachments = [] }) {
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
    attachments,
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

async function requireAdmin(req, res) {
  if (!isAuthorizedAdmin(req)) {
    sendJson(res, 401, { message: 'Unauthorized.' });
    return false;
  }

  return true;
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
        endpoints: [
          '/api/health',
          '/api/reports',
          '/api/reviews',
          '/api/admin/submissions',
          '/api/admin/reports',
          '/api/admin/reviews',
        ],
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
    if (!(await requireAdmin(req, res))) {
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

      const screenshotAttachment = validated.value.screenshot;
      const savedReport = await createReport({
        ...validated.value,
        screenshot: getSanitizedScreenshot(screenshotAttachment),
      });

      let email;
      try {
        email = await sendMail({
          subject: `New crypto incident report (${savedReport.platform})`,
          text: formatReportEmail(savedReport),
          replyTo: savedReport.contactEmail,
          attachments: createAttachmentFromScreenshot(screenshotAttachment),
        });
      } catch (error) {
        console.error('Report notification email failed:', error);
        email = { sent: false, error: 'Email delivery failed after report was saved.' };
      }

      sendJson(res, 201, {
        message: 'Report submitted successfully.',
        report: savedReport,
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

      const newReview = await createReview(validated.value);

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

  if (req.method === 'POST' && url.pathname === '/api/admin/reports') {
    if (!(await requireAdmin(req, res))) {
      return;
    }

    try {
      const payload = await collectJsonBody(req);
      const validated = validateReportInput(payload);

      if (!validated.ok) {
        sendJson(res, 400, { message: validated.message });
        return;
      }

      const newReport = await createReport({
        ...validated.value,
        screenshot: getSanitizedScreenshot(validated.value.screenshot),
      });

      sendJson(res, 201, {
        message: 'Report added successfully.',
        report: newReport,
      });
    } catch (error) {
      sendJson(res, 500, { message: 'Unable to add report.', error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/reviews') {
    if (!(await requireAdmin(req, res))) {
      return;
    }

    try {
      const payload = await collectJsonBody(req);
      const validated = validateReviewInput(payload);

      if (!validated.ok) {
        sendJson(res, 400, { message: validated.message });
        return;
      }

      const newReview = await createReview(validated.value);
      sendJson(res, 201, {
        message: 'Review added successfully.',
        review: newReview,
      });
    } catch (error) {
      sendJson(res, 500, { message: 'Unable to add review.', error: error.message });
    }
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/reports/')) {
    if (!(await requireAdmin(req, res))) {
      return;
    }

    const reportId = url.pathname.replace('/api/admin/reports/', '');

    try {
      const deletedReport = await deleteReportById(reportId);

      if (!deletedReport) {
        sendJson(res, 404, { message: 'Report not found.' });
        return;
      }

      sendJson(res, 200, {
        message: 'Report deleted successfully.',
        report: deletedReport,
      });
    } catch (error) {
      sendJson(res, 500, { message: 'Unable to delete report.', error: error.message });
    }
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/reviews/')) {
    if (!(await requireAdmin(req, res))) {
      return;
    }

    const reviewId = url.pathname.replace('/api/admin/reviews/', '');

    try {
      const deletedReview = await deleteReviewById(reviewId);

      if (!deletedReview) {
        sendJson(res, 404, { message: 'Review not found.' });
        return;
      }

      sendJson(res, 200, {
        message: 'Review deleted successfully.',
        review: deletedReview,
      });
    } catch (error) {
      sendJson(res, 500, { message: 'Unable to delete review.', error: error.message });
    }
    return;
  }

  sendJson(res, 404, { message: 'Not found' });
});

server.listen(PORT, async () => {
  console.log(`Backend server running at http://localhost:${PORT}`);

  try {
    await connectToDatabase();
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }
});
