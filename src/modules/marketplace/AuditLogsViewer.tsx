import { useEffect, useState } from "react";
import { getAuditLogs } from "../../services/api";

export default function AuditLogsViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    getAuditLogs(page, 20, actionFilter || undefined).then((data) => {
      if (!mounted) return;
      setLogs(data.logs);
      setPagination(data.pagination);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [page, actionFilter]);

  const actions = [...new Set(logs.map((l) => l.action))];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card">
        <h3 className="font-display text-sm mb-4">Filters</h3>
        <label className="block">
          <div className="label text-xs">Action</div>
          <select
            className="input text-xs"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Stats */}
      <div className="card text-center">
        <div className="text-2xl font-display text-[var(--gold)]">{pagination.total}</div>
        <div className="text-xs mt-1 text-[var(--text-soft)]">Total Audit Log Entries</div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="card text-center text-[var(--text-soft)]">No audit logs found</div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--line)]">
                <tr className="text-left">
                  <th className="py-2 px-2">Timestamp</th>
                  <th className="py-2 px-2">Action</th>
                  <th className="py-2 px-2">Entity</th>
                  <th className="py-2 px-2">User</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log._id}
                    className="border-b border-[var(--line)]/20 hover:bg-[var(--line)]/10 cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="py-2 px-2 text-[var(--text-soft)]">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-2 font-mono">{log.action}</td>
                    <td className="py-2 px-2">{log.entity}</td>
                    <td className="py-2 px-2 text-[var(--text-soft)]">
                      {log.userId ? String(log.userId).slice(0, 8) : "System"}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-xs px-2 py-1 rounded font-semibold ${
                          log.success
                            ? "bg-green-100 text-green-700"
                            : log.severity === "error"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {log.success ? "✓" : "✗"}
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

      {/* Detail Panel */}
      {selectedLog && (
        <div className="card">
          <h4 className="font-display text-sm mb-4">Log Details</h4>

          <div className="space-y-3 text-xs">
            <div>
              <div className="label">Action</div>
              <div className="font-mono">{selectedLog.action}</div>
            </div>
            <div>
              <div className="label">Entity</div>
              <div>{selectedLog.entity}</div>
            </div>
            <div>
              <div className="label">Entity ID</div>
              <div className="font-mono text-[var(--text-soft)]">{selectedLog.entityId}</div>
            </div>
            <div>
              <div className="label">Timestamp</div>
              <div>{new Date(selectedLog.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="label">Severity</div>
              <div className="capitalize">{selectedLog.severity}</div>
            </div>
            {selectedLog.errorMessage && (
              <div>
                <div className="label">Error</div>
                <div className="text-red-600 font-mono text-[10px] break-words">{selectedLog.errorMessage}</div>
              </div>
            )}
            {Object.keys(selectedLog.changes || {}).length > 0 && (
              <div>
                <div className="label">Changes</div>
                <pre className="bg-[var(--line)]/20 p-2 rounded text-[10px] overflow-auto">
                  {JSON.stringify(selectedLog.changes, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <button className="btn-ghost text-xs mt-4 w-full" onClick={() => setSelectedLog(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
