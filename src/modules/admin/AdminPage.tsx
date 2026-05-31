import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  getAdminAcademyEnrollments,
  getAdminActions,
  getAdminOverview,
  getAdminUsers,
  updateUser,
  type AcademyEnrollment,
  type AdminOverview,
  type AuthUser,
} from "../../services/api";
import ManagementTeamAdmin from "./ManagementTeamAdmin";
import SupportKnowledgeAdmin from "./SupportKnowledgeAdmin";
import SiteConfigAdmin from "./SiteConfigAdmin";
import SupportConversationsAdmin from "./SupportConversationsAdmin";
import { useAuth } from "../../store/auth";

export default function AdminPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [actions, setActions] = useState<AdminOverview["recentActions"]>([]);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    Promise.all([getAdminOverview(), getAdminUsers(), getAdminActions(), getAdminAcademyEnrollments()])
      .then(([nextOverview, nextUsers, nextActions, nextEnrollments]) => {
        if (!isMounted) return;
        setOverview(nextOverview);
        setUsers(nextUsers);
        setActions(nextActions);
        setEnrollments(nextEnrollments);
      })
      .catch((nextError) => {
        if (!isMounted) return;
        setOverview(null);
        setUsers([]);
        setActions([]);
        setEnrollments([]);
        const fallbackMessage = "Unable to load admin data. Check backend status and sign in again.";
        setError(nextError instanceof Error && nextError.message ? nextError.message : fallbackMessage);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.role]);

  const handleEditPhone = async (id: string) => {
    const current = users.find((u) => u.id === id);
    const nextPhone = prompt("Enter phone number for " + (current?.name || "admin"), current?.phone || "") || null;
    if (nextPhone === null) return;
    const updated = await updateUser(id, { phone: nextPhone });
    if (updated) {
      setUsers((s) => s.map((u) => (u.id === id ? updated : u)));
    } else {
      alert("Failed to update user");
    }
  };

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: "/admin" }} />;
  }

  if (user.role !== "admin") {
    return (
      <div className="card space-y-3">
        <h2 className="font-display text-2xl">Admin access required</h2>
        <p className="text-sm text-[var(--text-soft)]">
          Your account does not have permission to open the admin dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <p className="text-sm text-[var(--text-soft)]">Admin console</p>
        <h2 className="mt-2 font-display text-2xl">Platform operations dashboard</h2>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Track users, activity, catalog health, and platform engagement from a single control panel.
        </p>
      </div>

      {!isLoading && error ? (
        <div className="card border border-red-400/40 bg-red-500/10 text-red-100">
          <p className="font-medium">Failed to fetch admin dashboard data.</p>
          <p className="mt-2 text-sm text-red-100/90">{error}</p>
        </div>
      ) : null}

      {isLoading || !overview ? (
        <div className="card">Loading admin overview...</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Users", value: overview.stats.users },
              { label: "Actions", value: overview.stats.actions },
              { label: "Courses", value: overview.stats.courses },
              { label: "Listings", value: overview.stats.listings },
              { label: "Live Sessions", value: overview.stats.liveSessions },
              { label: "Metrics", value: overview.stats.metrics },
              { label: "Enrollments", value: overview.stats.enrollments },
              { label: "Live Joins", value: overview.stats.liveJoins },
            ].map((item) => (
              <article key={item.label} className="card">
                <p className="text-xs uppercase tracking-wide text-[var(--text-soft)]">{item.label}</p>
                <p className="mt-3 font-display text-2xl text-[var(--gold)]">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card space-y-4">
              <div>
                <h3 className="font-display text-2xl">Role distribution</h3>
                <p className="text-sm text-[var(--text-soft)]">Current user mix across the platform.</p>
              </div>
              <div className="space-y-3">
                {overview.roleCounts.map((item) => (
                  <div key={item._id} className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                    <span className="capitalize text-sm text-[var(--text-soft)]">{item._id}</span>
                    <span className="font-display text-xl text-[var(--gold)]">{item.count}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card space-y-4">
              <div>
                <h3 className="font-display text-2xl">Recent activity</h3>
                <p className="text-sm text-[var(--text-soft)]">Latest actions logged by users.</p>
              </div>
              <div className="space-y-3">
                {actions.map((action) => (
                  <div key={action.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 text-sm">
                    <p className="font-medium text-[var(--text)]">{action.kind}</p>
                    <p className="text-[var(--text-soft)]">
                      {action.actorName ?? action.actorEmail ?? "System"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {new Date(action.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="card space-y-4">
            <div>
              <h3 className="font-display text-2xl">Registered users</h3>
              <p className="text-sm text-[var(--text-soft)]">Latest user records available to the admin session.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
              {users.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-1 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-[var(--text)]">{entry.name}</p>
                    <p className="text-[var(--text-soft)]">{entry.email}</p>
                  </div>
                   <div className="flex items-center gap-2">
                     <span className="self-start rounded-full border border-[var(--line)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--text-soft)] sm:self-center">{entry.role}</span>
                     <button onClick={() => handleEditPhone(entry.id)} className="btn border text-sm">Edit contact</button>
                   </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h3 className="font-display text-2xl">Academy enrollments</h3>
              <p className="text-sm text-[var(--text-soft)]">Monitor who enrolled and how often they join live sessions.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
              {enrollments.length === 0 ? (
                <div className="bg-[var(--panel)] px-4 py-4 text-sm text-[var(--text-soft)]">No enrollments yet.</div>
              ) : (
                enrollments.map((entry) => (
                  <div key={entry.id} className="flex flex-col gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm last:border-b-0 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-medium text-[var(--text)]">{entry.userName ?? "Unknown user"}</p>
                      <p className="text-[var(--text-soft)]">{entry.userEmail ?? "No email"}</p>
                      <p className="text-[var(--text-soft)]">Course: {entry.courseTitle ?? `#${entry.courseId}`}</p>
                    </div>
                    <div className="text-[var(--text-soft)]">
                      <p>Enrolled: {new Date(entry.enrolledAt).toLocaleString()}</p>
                      <p>Live joins: {entry.liveJoinCount}</p>
                      <p>Last join: {entry.lastJoinedLiveAt ? new Date(entry.lastJoinedLiveAt).toLocaleString() : "Not joined yet"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <SiteConfigAdmin />

          <SupportKnowledgeAdmin />

          <SupportConversationsAdmin />

          <ManagementTeamAdmin />
        </>
      )}
    </div>
  );
}