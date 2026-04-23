import { useState } from 'react';
import { buildApiUrl, parseApiResponse } from '../lib/api';

const ADMIN_KEY_STORAGE = 'adminAccessKey';

function AdminSubmissions() {
  const [adminKey, setAdminKey] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.sessionStorage.getItem(ADMIN_KEY_STORAGE) || '';
  });
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchSubmissions = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(buildApiUrl('/api/admin/submissions'), {
        headers: {
          'x-admin-key': adminKey,
        },
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load submissions.');
      }

      setReports(data.reports || []);
      setReviews(data.reviews || []);
      setHasLoaded(true);
      window.sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
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
  };

  return (
    <section className="page-section">
      <div className="section-header">
        <span>Admin</span>
        <h1>Private submissions view</h1>
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
            {isLoading ? 'Loading...' : 'Load Submissions'}
          </button>
          {hasLoaded && (
            <button type="button" className="button secondary" onClick={handleSignOut}>
              Clear Access
            </button>
          )}
        </div>
        {errorMessage && <div className="form-message error">{errorMessage}</div>}
      </form>

      {hasLoaded && (
        <div className="admin-results">
          <section className="admin-section">
            <h2>Reports</h2>
            {reports.length === 0 ? (
              <p>No reports submitted yet.</p>
            ) : (
              <ul className="reports-list">
                {reports.map((report) => (
                  <li key={report.id}>
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
            <h2>Reviews</h2>
            {reviews.length === 0 ? (
              <p>No reviews submitted yet.</p>
            ) : (
              <ul className="reports-list">
                {reviews.map((review) => (
                  <li key={review.id}>
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
