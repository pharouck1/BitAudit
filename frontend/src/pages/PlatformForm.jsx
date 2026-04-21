import { useState } from 'react';

const BRAND_NAME = 'BitAudit Forensics';
const DISCLAIMER_KEY = 'reportDisclaimerAccepted';
const STAR_OPTIONS = [1, 2, 3, 4, 5];
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the screenshot file.'));
    reader.readAsDataURL(file);
  });
}

function PlatformForm() {
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(DISCLAIMER_KEY) !== 'true';
  });
  const [formData, setFormData] = useState({
    platform: '',
    walletType: '',
    totalAssetValue: '',
    transactionIds: '',
    incidentDetails: '',
    contactEmail: '',
    contactPhone: '',
    screenshot: null,
  });
  const [reviewData, setReviewData] = useState({
    reviewRating: 0,
    reviewComment: '',
  });
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reportErrorMessage, setReportErrorMessage] = useState('');
  const [reviewErrorMessage, setReviewErrorMessage] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [isDraggingScreenshot, setIsDraggingScreenshot] = useState(false);

  const handleReportChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleReviewChange = (event) => {
    const { name, value } = event.target;
    setReviewData((prev) => ({ ...prev, [name]: value }));
  };

  const handleScreenshotSelect = async (file) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setReportErrorMessage('Screenshot must be an image file.');
      return;
    }

    if (file.size > MAX_SCREENSHOT_SIZE) {
      setReportErrorMessage('Screenshot must be 5MB or smaller.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setReportErrorMessage('');
      setFormData((prev) => ({
        ...prev,
        screenshot: {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        },
      }));
    } catch (error) {
      setReportErrorMessage(error.message || 'Could not read the screenshot file.');
    }
  };

  const handleScreenshotInputChange = async (event) => {
    const [file] = event.target.files || [];
    await handleScreenshotSelect(file);
  };

  const handleScreenshotDrop = async (event) => {
    event.preventDefault();
    setIsDraggingScreenshot(false);
    const [file] = event.dataTransfer.files || [];
    await handleScreenshotSelect(file);
  };

  const clearScreenshot = () => {
    setFormData((prev) => ({ ...prev, screenshot: null }));
  };

  const handleAcceptDisclaimer = () => {
    window.localStorage.setItem(DISCLAIMER_KEY, 'true');
    setShowDisclaimer(false);
  };

  const handleReportSubmit = async (event) => {
    event.preventDefault();
    setIsSubmittingReport(true);
    setReportErrorMessage('');

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit report.');
      }

      setReportSubmitted(true);
      setFormData({
        platform: '',
        walletType: '',
        totalAssetValue: '',
        transactionIds: '',
        incidentDetails: '',
        contactEmail: '',
        contactPhone: '',
        screenshot: null,
      });
    } catch (error) {
      setReportSubmitted(false);
      if (error instanceof TypeError) {
        setReportErrorMessage('Could not reach the report service. Start the backend server and try again.');
      } else {
        setReportErrorMessage(error.message || 'Failed to submit report.');
      }
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    setIsSubmittingReview(true);
    setReviewErrorMessage('');

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit review.');
      }

      setReviewSubmitted(true);
      setReviewData({
        reviewRating: 0,
        reviewComment: '',
      });
    } catch (error) {
      setReviewSubmitted(false);
      if (error instanceof TypeError) {
        setReviewErrorMessage('Could not reach the review service. Start the backend server and try again.');
      } else {
        setReviewErrorMessage(error.message || 'Failed to submit review.');
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <section className="page-section">
      {showDisclaimer && (
        <div className="disclaimer-overlay" role="dialog" aria-modal="true" aria-labelledby="report-disclaimer-title">
          <div className="disclaimer-card">
            <h2 id="report-disclaimer-title">Disclaimer Agreement</h2>
            <p>
              {BRAND_NAME} will NEVER ask for your private keys, seed phrases, or remote access to your computer.
              If anyone claiming to be from {BRAND_NAME} asks for these, report it immediately.
            </p>
            <button type="button" className="button primary" onClick={handleAcceptDisclaimer}>
              I Understand
            </button>
          </div>
        </div>
      )}
      <div className="section-header">
        <span>Report Incident</span>
        <h1>Tell us about your lost or stolen crypto</h1>
      </div>
      <form className="report-form" onSubmit={handleReportSubmit}>
        <label>
          Crypto platform or exchange
          <input
            type="text"
            name="platform"
            value={formData.platform}
            onChange={handleReportChange}
            placeholder="e.g. Binance, MetaMask, Coinbase"
            required
          />
        </label>
        <label>
          Wallet type
          <input
            type="text"
            name="walletType"
            value={formData.walletType}
            onChange={handleReportChange}
            placeholder="e.g. hardware wallet, hot wallet, exchange account"
            required
          />
        </label>
        <label>
          Total Asset Value
          <input
            type="text"
            name="totalAssetValue"
            value={formData.totalAssetValue}
            onChange={handleReportChange}
            placeholder="e.g. 12,500 USDT"
            required
          />
        </label>
        <label>
          Transaction ID (TXIDs)
          <input
            type="text"
            name="transactionIds"
            value={formData.transactionIds}
            onChange={handleReportChange}
            placeholder="Paste one or multiple TXIDs"
            required
          />
        </label>
        <label className="field-span-full">
          Incident description
          <textarea
            name="incidentDetails"
            value={formData.incidentDetails}
            onChange={handleReportChange}
            placeholder="Describe what happened, when it occurred, and any suspicious activity."
            rows="5"
            required
          />
        </label>
        <label>
          Email for updates
          <input
            type="email"
            name="contactEmail"
            value={formData.contactEmail}
            onChange={handleReportChange}
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          Phone number
          <input
            type="tel"
            name="contactPhone"
            value={formData.contactPhone}
            onChange={handleReportChange}
            placeholder="e.g. +1 555 123 4567"
            required
          />
        </label>
        <div className="field-span-full upload-field">
          <span className="upload-label">Screenshot of how you were scammed, if any</span>
          <label
            className={`dropzone${isDraggingScreenshot ? ' is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingScreenshot(true);
            }}
            onDragLeave={() => setIsDraggingScreenshot(false)}
            onDrop={handleScreenshotDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleScreenshotInputChange}
            />
            <span>Drag and drop a screenshot here, or click to upload</span>
            <small>Optional. PNG, JPG, WEBP or other image formats up to 5MB.</small>
          </label>
          {formData.screenshot && (
            <div className="upload-preview">
              <p>
                Attached screenshot: <strong>{formData.screenshot.name}</strong>
              </p>
              <button type="button" className="button secondary" onClick={clearScreenshot}>
                Remove Screenshot
              </button>
            </div>
          )}
        </div>
        <button type="submit" className="button primary" disabled={isSubmittingReport}>
          {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
        </button>
        {reportSubmitted && (
          <div className="form-message success">
            Thank you! Your incident report has been received. An agent has been assigned and you will receive an email update shortly.
          </div>
        )}
        {reportErrorMessage && (
          <div className="form-message error">
            {reportErrorMessage}
          </div>
        )}
      </form>
      <div className="section-header review-section-header">
        <span>Leave a Review</span>
        <h2>Rate your experience with us by leaving a review</h2>
      </div>
      <form className="review-form" onSubmit={handleReviewSubmit}>
        <fieldset className="review-fieldset">
          <legend>Your review</legend>
          <div className="star-rating" role="radiogroup" aria-label="Choose a rating from 1 to 5 stars">
            {STAR_OPTIONS.map((star) => {
              const isSelected = Number(reviewData.reviewRating) === star;

              return (
                <label
                  key={star}
                  className={`star-option${isSelected ? ' is-selected' : ''}`}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                >
                  <input
                    type="radio"
                    name="reviewRating"
                    value={star}
                    checked={isSelected}
                    onChange={handleReviewChange}
                    required
                  />
                  <span aria-hidden="true">★</span>
                </label>
              );
            })}
          </div>
          <textarea
            name="reviewComment"
            value={reviewData.reviewComment}
            onChange={handleReviewChange}
            placeholder="Share your review or feedback about the reporting experience. Optional."
            rows="4"
          />
        </fieldset>
        <button type="submit" className="button secondary" disabled={isSubmittingReview}>
          {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
        </button>
        {reviewSubmitted && (
          <div className="form-message success">
            Thanks for the review.
          </div>
        )}
        {reviewErrorMessage && (
          <div className="form-message error">
            {reviewErrorMessage}
          </div>
        )}
      </form>
    </section>
  );
}

export default PlatformForm;
