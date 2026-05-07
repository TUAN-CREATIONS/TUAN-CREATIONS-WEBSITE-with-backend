import { useEffect, useState } from "react";
import { getVerificationRequests, reviewVerificationRequest, type VerificationRequest } from "../../services/api";

export default function VerificationAdmin() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({ status: "pending", adminNote: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    getVerificationRequests()
      .then((r) => {
        if (!mounted) return;
        setRequests(r);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleReview = async (e: any) => {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    try {
      await reviewVerificationRequest(selectedId, reviewForm.status, reviewForm.adminNote);
      setMessage(`✓ Request reviewed as ${reviewForm.status}`);
      setSelectedId(null);
      setRequests(await getVerificationRequests());
    } catch (err: any) {
      setMessage(`✗ ${err?.message || "Failed to review"}`);
    } finally {
      setLoading(false);
    }
  };

  const selected = requests.find((r) => r._id === selectedId);
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const reviewedRequests = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-display text-2xl">Verification Admin</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">Review provider verification requests</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="text-xs text-[var(--text-soft)]">Pending</div>
          <div className="text-2xl font-display text-[var(--gold)]">{pendingRequests.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--text-soft)]">Total</div>
          <div className="text-2xl font-display">{requests.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--text-soft)]">Reviewed</div>
          <div className="text-2xl font-display text-emerald-300">{reviewedRequests.length}</div>
        </div>
      </div>

      {selectedId && selected ? (
        <form className="card space-y-4" onSubmit={handleReview}>
          <h3 className="font-display text-lg">Review Request</h3>

          <div className="space-y-2 border-b border-[var(--line)] pb-3">
            <div className="text-sm">
              <strong>Provider:</strong> {selected?.providerId}
            </div>
            <div className="text-sm">
              <strong>Note:</strong> {selected?.note || "(none)"}
            </div>
            <div className="text-sm">
              <strong>Documents:</strong>
              <ul className="mt-1 ml-4 list-disc">
                {selected?.documents?.map((doc, i) => (
                  <li key={i} className="text-xs text-[var(--text-soft)]">
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <label className="block">
            <div className="label">Decision</div>
            <select
              className="input"
              value={reviewForm.status}
              onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          <label className="block">
            <div className="label">Admin Note</div>
            <textarea
              className="input"
              value={reviewForm.adminNote}
              onChange={(e) => setReviewForm({ ...reviewForm, adminNote: e.target.value })}
              placeholder="Reason for decision..."
            />
          </label>

          <div className="flex gap-2">
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Processing..." : "Save Decision"}
            </button>
            <button className="btn-ghost" type="button" onClick={() => setSelectedId(null)}>
              Cancel
            </button>
          </div>

          {message && <p className="mt-2 text-sm">{message}</p>}
        </form>
      ) : (
        <section className="card">
          <h3 className="font-display text-lg">Pending Requests</h3>
          {pendingRequests.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-soft)]">No pending requests</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pendingRequests.map((req) => (
                <li
                  key={req._id}
                  onClick={() => {
                    setSelectedId(req._id || "");
                    setReviewForm({ status: "pending", adminNote: "" });
                  }}
                  className="flex cursor-pointer items-center justify-between border-b border-[var(--line)] pb-2"
                >
                  <div className="text-sm">
                    <div className="font-medium">Request {req._id?.slice(0, 8)}...</div>
                    <div className="text-xs text-[var(--text-soft)]">
                      {new Date(req.createdAt || "").toLocaleDateString()}
                    </div>
                  </div>
                  <button className="btn-ghost text-xs">Review</button>
                </li>
              ))}
            </ul>
          )}

          {reviewedRequests.length > 0 && (
            <div className="mt-6">
              <h4 className="font-display text-sm">Recently Reviewed</h4>
              <ul className="mt-2 space-y-1 text-xs">
                {reviewedRequests.slice(0, 5).map((req) => (
                  <li key={req._id} className="text-[var(--text-soft)]">
                    {req._id?.slice(0, 8)}... — {req.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
