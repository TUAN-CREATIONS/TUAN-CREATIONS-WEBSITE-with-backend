import { useEffect, useState } from "react";
import { getPayouts, processPayout, type Payout } from "../../services/api";

export default function PayoutAdmin() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [status, setStatus] = useState<"all" | "pending" | "processing" | "completed" | "failed">("all");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getPayouts(status === "all" ? undefined : status).then((data) => {
      if (!mounted) return;
      setPayouts(data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [status]);

  const handleProcessPayout = async (payoutId: string, newStatus: "processing" | "completed" | "failed") => {
    setProcessing(true);
    try {
      const updated = await processPayout(payoutId, newStatus);
      setPayouts(payouts.map((p) => (p._id === payoutId ? updated : p)));
      setSelectedPayout(null);
      setMessage(`✓ Payout status updated to ${newStatus}`);
    } catch (err: any) {
      setMessage(`✗ ${err?.message || "Failed to process payout"}`);
    } finally {
      setProcessing(false);
    }
  };

  const totalAmount = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const completed = payouts.filter((p) => p.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-display text-[var(--gold)]">${(totalAmount || 0).toFixed(0)}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Total Amount</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-blue-500">{payouts.length}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Total Payouts</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-green-500">{completed}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Completed</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-orange-500">
            {payouts.filter((p) => p.status === "pending").length}
          </div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Pending</div>
        </div>
      </div>

      {message && <p className="text-sm font-semibold">{message}</p>}

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto">
        {(["all", "pending", "processing", "completed", "failed"] as const).map((s) => (
          <button
            key={s}
            className={`btn-ghost text-xs capitalize ${status === s ? "bg-[var(--gold)]/20" : ""}`}
            onClick={() => {
              setStatus(s);
              setLoading(true);
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card">Loading payouts...</div>
      ) : payouts.length === 0 ? (
        <div className="card text-center text-[var(--text-soft)]">No payouts found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* List */}
          <div className="md:col-span-2 space-y-2">
            {payouts.map((p) => (
              <div
                key={p._id}
                className={`p-3 rounded border cursor-pointer transition ${
                  selectedPayout?._id === p._id
                    ? "bg-[var(--gold)]/10 border-[var(--gold)]"
                    : "bg-white border-[var(--line)] hover:bg-[var(--line)]/20"
                }`}
                onClick={() => setSelectedPayout(p)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">Provider: {String(p.providerId).slice(0, 8)}...</span>
                  <span
                    className={`text-xs px-2 py-1 rounded font-semibold ${
                      p.status === "pending"
                        ? "bg-yellow-100 text-yellow-700"
                        : p.status === "processing"
                        ? "bg-blue-100 text-blue-700"
                        : p.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="text-lg font-display text-[var(--gold)]">${p.amount.toFixed(2)}</div>
                <div className="text-xs text-[var(--text-soft)] mt-1">{p.paymentMethod}</div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          {selectedPayout && (
            <div className="card">
              <h4 className="font-display text-sm mb-4">Payout Details</h4>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="label text-xs">Amount</div>
                  <div className="text-lg font-display text-[var(--gold)]">${selectedPayout.amount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="label text-xs">Currency</div>
                  <div className="text-xs">{selectedPayout.currency}</div>
                </div>
                <div>
                  <div className="label text-xs">Payment Method</div>
                  <div className="text-xs capitalize">{selectedPayout.paymentMethod}</div>
                </div>
                <div>
                  <div className="label text-xs">Status</div>
                  <div className="text-xs capitalize">{selectedPayout.status}</div>
                </div>
                <div>
                  <div className="label text-xs">Commissions</div>
                  <div className="text-xs text-[var(--text-soft)]">{selectedPayout.commissionIds?.length || 0}</div>
                </div>
              </div>

              {selectedPayout.status === "pending" && (
                <div className="space-y-2">
                  <button
                    className="btn-primary text-xs w-full"
                    onClick={() => handleProcessPayout(selectedPayout._id!, "processing")}
                    disabled={processing}
                  >
                    {processing ? "Processing..." : "Start Processing"}
                  </button>
                  <button
                    className="btn-ghost text-xs w-full text-red-600"
                    onClick={() => handleProcessPayout(selectedPayout._id!, "failed")}
                    disabled={processing}
                  >
                    Mark Failed
                  </button>
                </div>
              )}

              {selectedPayout.status === "processing" && (
                <button
                  className="btn-primary text-xs w-full"
                  onClick={() => handleProcessPayout(selectedPayout._id!, "completed")}
                  disabled={processing}
                >
                  {processing ? "Completing..." : "Mark Completed"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
