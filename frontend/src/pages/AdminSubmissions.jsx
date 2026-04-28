import { useState } from 'react';
import { buildApiUrl, parseApiResponse } from '../lib/api';

const ADMIN_KEY_STORAGE = 'adminAccessKey';
const EMPTY_REPORT_FORM = {
  platform: '',
  walletType: '',
  totalAssetValue: '',
  transactionIds: '',
  incidentDetails: '',
  contactEmail: '',
  contactPhone: '',
};
const EMPTY_REVIEW_FORM = {
  reviewRating: 5,
  reviewComment: '',
};

function AdminSubmissions() {
  const [adminKey, setAdminKey] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.sessionStorage.getItem(ADMIN_KEY_STORAGE) || '';
  });
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reportForm, setReportForm] = useState(EMPTY_REPORT_FORM);
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const runAdminRequest = async (path, options = {}) => {
    const headers = {
      'x-admin-key': adminKey,
      ...(options.headers || {}),
    };

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(buildApiUrl(path), {
      ...options,
      headers,
    });
    const data = await parseApiResponse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Admin request failed.');
    }

    return data;
  };

  const loadSubmissions = async () => {
    const data = await runAdminRequest('/api/admin/submissions');

    setReports(data.reports || []);
    setReviews(data.reviews || []);
    setHasLoaded(true);
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
  };

  const fetchSubmissions = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await loadSubmissions();
    } catch (error) {
      setHasLoaded(false);
      setErrorMessage(error.message || 'Failed to load submissions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey('');
    setReports([]);
    setReviews([]);
    setHasLoaded(false);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleReportFormChange = (event) => {
    const { name, value } = event.target;
    setReportForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleReviewFormChange = (event) => {
    const { name, value } = event.target;
    setReviewForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddReport = async (event) => {
    event.preventDefault();
    setIsSavingReport(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const data = await runAdminRequest('/api/admin/reports', {
        method: 'POST',
        body: JSON.stringify(reportForm),
      });

      setReports((prev) => [data.report, ...prev]);
      setReportForm(EMPTY_REPORT_FORM);
      setHasLoaded(true);
      setSuccessMessage('Report added successfully.');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to add report.');
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleAddReview = async (event) => {
    event.preventDefault();
    setIsSavingReview(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const data = await runAdminRequest('/api/admin/reviews', {
        method: 'POST',
        body: JSON.stringify(reviewForm),
      });

      setReviews((prev) => [data.review, ...prev]);
      setReviewForm(EMPTY_REVIEW_FORM);
      setHasLoaded(true);
      setSuccessMessage('Review added successfully.');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to add review.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    setBusyDeleteId(`report:${reportId}`);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await runAdminRequest(`/api/admin/reports/${reportId}`, {
        method: 'DELETE',
      });

      setReports((prev) => prev.filter((report) => report.id !== reportId));
      setSuccessMessage('Report deleted successfully.');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to delete report.');
    } finally {
      setBusyDeleteId('');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    setBusyDeleteId(`review:${reviewId}`);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await runAdminRequest(`/api/admin/reviews/${reviewId}`, {
        method: 'DELETE',
      });

      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
      setSuccessMessage('Review deleted successfully.');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to delete review.');
    } finally {
      setBusyDeleteId('');
    }
  };

  return (
    <section className="page-section">
      <div className="section-header">
        <span>Admin</span>
        <h1>Manage submissions</h1>
      </div>

      <form className="admin-form" onSubmit={fetchSubmissions}>
        <label className="field-span-full">
          Admin access key
          <input
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="Enter admin key"
            required
          />
        </label>
        <div className="admin-actions">
          <button type="submit" className="button primary" disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Load Database'}
          </button>
          {hasLoaded && (
            <button type="button" className="button secondary" onClick={handleSignOut}>
              Clear Access
            </button>
          )}
        </div>
        {errorMessage && <div className="form-message error">{errorMessage}</div>}
        {successMessage && <div className="form-message">{successMessage}</div>}
      </form>

      {hasLoaded && (
        <div className="admin-results">
          <section className="admin-section">
            <div className="admin-section-header">
              <h2>Add report</h2>
              <p>Create a report directly in MongoDB.</p>
            </div>
            <form className="report-form admin-entry-form" onSubmit={handleAddReport}>
              <label>
                Crypto platform or exchange
                <input
                  type="text"
                  name="platform"
                  value={reportForm.platform}
                  onChange={handleReportFormChange}
                  required
                />
              </label>
              <label>
                Wallet type
                <input
                  type="text"
                  name="walletType"
                  value={reportForm.walletType}
                  onChange={handleReportFormChange}
                  required
                />
              </label>
              <label>
                Total asset value
                <input
                  type="text"
                  name="totalAssetValue"
                  value={reportForm.totalAssetValue}
                  onChange={handleReportFormChange}
                  required
                />
              </label>
              <label>
                Transaction IDs
                <input
                  type="text"
                  name="transactionIds"
                  value={reportForm.transactionIds}
                  onChange={handleReportFormChange}
                  required
                />
              </label>
              <label>
                Contact email
                <input
                  type="email"
                  name="contactEmail"
                  value={reportForm.contactEmail}
                  onChange={handleReportFormChange}
                  required
                />
              </label>
              <label>
                Contact phone
                <input
                  type="text"
                  name="contactPhone"
                  value={reportForm.contactPhone}
                  onChange={handleReportFormChange}
                  required
                />
              </label>
              <label className="field-span-full">
                Incident details
                <textarea
                  name="incidentDetails"
                  value={reportForm.incidentDetails}
                  onChange={handleReportFormChange}
                  rows="4"
                  required
                />
              </label>
              <button type="submit" className="button primary" disabled={isSavingReport}>
                {isSavingReport ? 'Saving...' : 'Add Report'}
              </button>
            </form>
          </section>

          <section className="admin-section">
            <div className="admin-section-header">
              <h2>Add review</h2>
              <p>Create a review directly in MongoDB.</p>
            </div>
            <form className="review-form admin-entry-form" onSubmit={handleAddReview}>
              <label>
                Rating
                <input
                  type="number"
                  name="reviewRating"
                  min="1"
                  max="5"
                  value={reviewForm.reviewRating}
                  onChange={handleReviewFormChange}
                  required
                />
              </label>
              <label className="field-span-full">
                Comment
                <textarea
                  name="reviewComment"
                  value={reviewForm.reviewComment}
                  onChange={handleReviewFormChange}
                  rows="4"
                />
              </label>
              <button type="submit" className="button primary" disabled={isSavingReview}>
                {isSavingReview ? 'Saving...' : 'Add Review'}
              </button>
            </form>
          </section>

          <section className="admin-section">
            <div className="admin-section-header">
              <h2>Reports</h2>
              <p>{reports.length} stored in the database.</p>
            </div>
            {reports.length === 0 ? (
              <p>No reports submitted yet.</p>
            ) : (
              <ul className="reports-list">
                {reports.map((report) => (
                  <li key={report.id}>
                    <div className="admin-card-actions">
                      <button
                        type="button"
                        className="button danger"
                        onClick={() => handleDeleteReport(report.id)}
                        disabled={busyDeleteId === `report:${report.id}`}
                      >
                        {busyDeleteId === `report:${report.id}` ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    <p><strong>Platform:</strong> {report.platform}</p>
                    <p><strong>Wallet:</strong> {report.walletType}</p>
                    <p><strong>Total Asset Value:</strong> {report.totalAssetValue || 'N/A'}</p>
                    <p><strong>TXIDs:</strong> {report.transactionIds || 'N/A'}</p>
                    <p><strong>Email:</strong> {report.contactEmail}</p>
                    <p><strong>Phone:</strong> {report.contactPhone || 'N/A'}</p>
                    <p><strong>Incident:</strong> {report.incidentDetails}</p>
                    <p><strong>Screenshot:</strong> {report.screenshot ? report.screenshot.name : 'None attached'}</p>
                    <p className="report-time">Submitted: {new Date(report.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-section">
            <div className="admin-section-header">
              <h2>Reviews</h2>
              <p>{reviews.length} stored in the database.</p>
            </div>
            {reviews.length === 0 ? (
              <p>No reviews submitted yet.</p>
            ) : (
              <ul className="reports-list">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <div className="admin-card-actions">
                      <button
                        type="button"
                        className="button danger"
                        onClick={() => handleDeleteReview(review.id)}
                        disabled={busyDeleteId === `review:${review.id}`}
                      >
                        {busyDeleteId === `review:${review.id}` ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    <p><strong>Rating:</strong> {review.reviewRating}/5</p>
                    <p><strong>Comment:</strong> {review.reviewComment || 'No comment provided.'}</p>
                    <p className="report-time">Submitted: {new Date(review.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default AdminSubmissions;
