import { useEffect, useState } from "react";
import { getDisputes, resolveDispute, type Dispute } from "../../services/api";

export default function DisputeAdmin() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [form, setForm] = useState({ status: "resolved_provider_wins", resolution: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getDisputes().then((d) => {
      if (!mounted) return;
      setDisputes(d);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleResolve = async () => {
    if (!selectedDispute) return;
    setSaving(true);
    try {
      const resolved = await resolveDispute(selectedDispute._id!, form.resolution, form.status);
      setDisputes(
        disputes.map((d) => (d._id === selectedDispute._id ? resolved : d))
      );
      setSelectedDispute(null);
      setMessage("✓ Dispute resolved");
    } catch (err: any) {
      setMessage(`✗ ${err?.message || "Failed to resolve dispute"}`);
    } finally {
      setSaving(false);
    }
  };

  const openDisputes = disputes.filter((d) => d.status === "open");
  const resolvedDisputes = disputes.filter((d) => d.status?.includes("resolved"));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="card text-center">
          <div className="text-2xl font-display text-orange-500">{openDisputes.length}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Open Disputes</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-[var(--gold)]">{resolvedDisputes.length}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Resolved</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-blue-500">{disputes.length}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Total</div>
        </div>
      </div>

      {message && <p className="text-sm font-semibold">{message}</p>}

      {loading ? (
        <div className="card">Loading disputes...</div>
      ) : disputes.length === 0 ? (
        <div className="card text-center text-[var(--text-soft)] text-sm">No disputes found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Disputes List */}
          <div className="md:col-span-2">
            <h3 className="font-display text-sm mb-4">All Disputes</h3>
            <div className="space-y-2">
              {disputes.map((d) => (
                <div
                  key={d._id}
                  className={`p-3 rounded border cursor-pointer transition ${
                    selectedDispute?._id === d._id
                      ? "bg-[var(--gold)]/10 border-[var(--gold)]"
                      : "bg-white border-[var(--line)] hover:bg-[var(--line)]/20"
                  }`}
                  onClick={() => setSelectedDispute(d)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">Order #{d.orderId}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded font-semibold ${
                        d.status === "open"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-soft)]">{d.reason}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedDispute && (
            <div className="card">
              <h4 className="font-display text-sm mb-4">Dispute Details</h4>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="label text-xs">Order ID</div>
                  <div className="text-xs text-[var(--text-soft)]">{selectedDispute.orderId}</div>
                </div>
                <div>
                  <div className="label text-xs">Reason</div>
                  <div className="text-xs">{selectedDispute.reason}</div>
                </div>
                <div>
                  <div className="label text-xs">Description</div>
                  <div className="text-xs text-[var(--text-soft)]">{selectedDispute.description}</div>
                </div>
                {selectedDispute.resolution && (
                  <div>
                    <div className="label text-xs">Resolution</div>
                    <div className="text-xs">{selectedDispute.resolution}</div>
                  </div>
                )}
              </div>

              {selectedDispute.status === "open" && (
                <>
                  <label className="block mb-3">
                    <div className="label text-xs">Outcome</div>
                    <select
                      className="input text-xs"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="resolved_provider_wins">Provider Wins</option>
                      <option value="resolved_buyer_wins">Buyer Wins</option>
                      <option value="resolved_split">Split Equally</option>
                    </select>
                  </label>

                  <label className="block mb-4">
                    <div className="label text-xs">Admin Notes</div>
                    <textarea
                      className="input text-xs"
                      value={form.resolution}
                      onChange={(e) => setForm({ ...form, resolution: e.target.value })}
                      placeholder="Decision details..."
                    />
                  </label>

                  <button
                    className="btn-primary text-xs w-full"
                    onClick={handleResolve}
                    disabled={saving}
                  >
                    {saving ? "Resolving..." : "Resolve Dispute"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
