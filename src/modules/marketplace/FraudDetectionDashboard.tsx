import { useEffect, useState } from "react";
import { getMarketplaceMetrics, checkOrderFraud, reviewUserFraudScore, type FraudAssessment } from "../../services/api";

export default function FraudDetectionDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [orderIdToCheck, setOrderIdToCheck] = useState("");
  const [fraudAssessment, setFraudAssessment] = useState<FraudAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [reviewForm, setReviewForm] = useState({ score: 0, riskLevel: "low", notes: "" });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getMarketplaceMetrics().then((data) => {
      if (!mounted) return;
      setMetrics(data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCheckOrder = async () => {
    if (!orderIdToCheck.trim()) {
      setMessage("Enter an order ID");
      return;
    }
    setChecking(true);
    try {
      const result = await checkOrderFraud(orderIdToCheck);
      setFraudAssessment(result);
      setMessage(null);
    } catch (err: any) {
      setMessage(`✗ ${err?.message || "Failed to check order"}`);
    } finally {
      setChecking(false);
    }
  };

  const handleReviewUser = async () => {
    if (!selectedUserId.trim()) {
      setMessage("Enter a user ID");
      return;
    }
    setChecking(true);
    try {
      await reviewUserFraudScore(selectedUserId, reviewForm.score, reviewForm.riskLevel, reviewForm.notes);
      setMessage("✓ User fraud score reviewed");
      setSelectedUserId("");
      setReviewForm({ score: 0, riskLevel: "low", notes: "" });
    } catch (err: any) {
      setMessage(`✗ ${err?.message || "Failed to review user"}`);
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <div className="card">Loading fraud metrics...</div>;

  const fraudMetrics = metrics?.fraud || {};

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-display text-orange-500">{fraudMetrics.flaggedOrders || 0}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Flagged Orders</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-[var(--gold)]">
            {(fraudMetrics.avgScore || 0).toFixed(0)}
          </div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Avg Fraud Score</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-blue-500">{metrics?.orders?.total || 0}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Total Orders</div>
        </div>
      </div>

      {message && <p className="text-sm font-semibold">{message}</p>}

      {/* Check Order */}
      <div className="card">
        <h3 className="font-display text-sm mb-4">Check Order Fraud Score</h3>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-xs"
            value={orderIdToCheck}
            onChange={(e) => setOrderIdToCheck(e.target.value)}
            placeholder="Enter order ID..."
          />
          <button
            className="btn-primary text-xs"
            onClick={handleCheckOrder}
            disabled={checking}
          >
            {checking ? "Checking..." : "Check"}
          </button>
        </div>

        {fraudAssessment && (
          <div className="mt-4 p-3 bg-[var(--line)]/20 rounded">
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div>
                <div className="text-xs text-[var(--text-soft)]">Score</div>
                <div className="text-lg font-display">{fraudAssessment.fraudScore}/100</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-soft)]">Risk Level</div>
                <div
                  className={`text-xs font-semibold px-2 py-1 rounded w-fit ${
                    fraudAssessment.riskLevel === "low"
                      ? "bg-green-100 text-green-700"
                      : fraudAssessment.riskLevel === "medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : fraudAssessment.riskLevel === "high"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {fraudAssessment.riskLevel}
                </div>
              </div>
            </div>

            {fraudAssessment.flags.length > 0 && (
              <div>
                <div className="text-xs text-[var(--text-soft)] mb-1">Flags</div>
                <div className="flex flex-wrap gap-1">
                  {fraudAssessment.flags.map((flag, i) => (
                    <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded capitalize">
                      {flag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review User Fraud Score */}
      <div className="card">
        <h3 className="font-display text-sm mb-4">Review User Fraud Score</h3>

        <label className="block mb-3">
          <div className="label text-xs">User ID</div>
          <input
            className="input text-xs"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            placeholder="Enter user ID..."
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <div className="label text-xs">Fraud Score</div>
            <input
              className="input text-xs"
              type="number"
              value={reviewForm.score}
              onChange={(e) => setReviewForm({ ...reviewForm, score: Number(e.target.value) })}
              min="0"
              max="100"
            />
          </label>

          <label className="block">
            <div className="label text-xs">Risk Level</div>
            <select
              className="input text-xs"
              value={reviewForm.riskLevel}
              onChange={(e) => setReviewForm({ ...reviewForm, riskLevel: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>

        <label className="block mb-4">
          <div className="label text-xs">Notes</div>
          <textarea
            className="input text-xs"
            value={reviewForm.notes}
            onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
            placeholder="Admin review notes..."
          />
        </label>

        <button
          className="btn-primary text-xs w-full"
          onClick={handleReviewUser}
          disabled={checking}
        >
          {checking ? "Reviewing..." : "Review User"}
        </button>
      </div>

      {/* Dispute Metrics */}
      <div className="card">
        <h3 className="font-display text-sm mb-4">Dispute Metrics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-[var(--text-soft)]">Total Disputes</div>
            <div className="text-2xl font-display text-[var(--gold)]">{metrics?.disputes?.total || 0}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-soft)]">Open Disputes</div>
            <div className="text-2xl font-display text-orange-500">{metrics?.disputes?.open || 0}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-[var(--text-soft)]">Avg Resolution Time</div>
            <div className="text-sm text-[var(--text-soft)]">
              {metrics?.disputes?.avgResolutionTimeMs
                ? `${(metrics.disputes.avgResolutionTimeMs / 1000 / 60 / 60).toFixed(1)} hours`
                : "N/A"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
