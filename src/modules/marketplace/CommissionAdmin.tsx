import { useEffect, useState } from "react";
import { getCommissions, type Commission } from "../../services/api";

export default function CommissionAdmin() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCommissions(page, 20).then((data) => {
      if (!mounted) return;
      setCommissions(data.commissions);
      setPagination(data.pagination);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [page]);

  const totalNetAmount = commissions.reduce((sum, c) => sum + (c.netAmount || 0), 0);
  const totalGrossAmount = commissions.reduce((sum, c) => sum + (c.grossAmount || 0), 0);
  const totalCommissionTaken = commissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-display text-[var(--gold)]">${(totalGrossAmount || 0).toFixed(0)}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Gross Amount</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-[var(--gold)]">${(totalCommissionTaken || 0).toFixed(0)}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Commission Taken</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-green-500">${(totalNetAmount || 0).toFixed(0)}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Provider Net</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display">{commissions.length}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Commissions</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card">Loading commissions...</div>
      ) : commissions.length === 0 ? (
        <div className="card text-center text-[var(--text-soft)]">No commissions found</div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--line)]">
                <tr className="text-left">
                  <th className="py-2 px-2">Order ID</th>
                  <th className="py-2 px-2">Provider</th>
                  <th className="py-2 px-2">Gross</th>
                  <th className="py-2 px-2">Rate</th>
                  <th className="py-2 px-2">Commission</th>
                  <th className="py-2 px-2">Net</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c._id} className="border-b border-[var(--line)]/20 hover:bg-[var(--line)]/10">
                    <td className="py-2 px-2 font-mono text-[var(--text-soft)]">
                      {String(c.orderId).slice(0, 8)}...
                    </td>
                    <td className="py-2 px-2">{String(c.providerId).slice(0, 8)}...</td>
                    <td className="py-2 px-2">${c.grossAmount.toFixed(2)}</td>
                    <td className="py-2 px-2">{(c.commissionRate * 100).toFixed(0)}%</td>
                    <td className="py-2 px-2 font-semibold">${c.commissionAmount.toFixed(2)}</td>
                    <td className="py-2 px-2 text-green-600 font-semibold">${c.netAmount.toFixed(2)}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-xs px-2 py-1 rounded font-semibold ${
                          c.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : c.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                className="btn-ghost text-xs"
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                ← Previous
              </button>
              <span className="text-xs text-[var(--text-soft)] my-auto">
                Page {page} of {pagination.pages}
              </span>
              <button
                className="btn-ghost text-xs"
                disabled={page === pagination.pages}
                onClick={() => setPage(Math.min(pagination.pages, page + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
