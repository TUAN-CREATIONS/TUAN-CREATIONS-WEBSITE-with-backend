import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getListings, recordAction, type Listing } from "../../services/api";

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getListings().then((items) => {
      if (!isMounted) return;
      setListings(items);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAction = async (kind: string, listingId: number) => {
    try {
      await recordAction(kind, { listingId });
      setMessage(`Saved ${kind.split(".").pop()} request for listing ${listingId}.`);
    } catch {
      setMessage(`Could not save the ${kind.split(".").pop()} request right now.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-display text-2xl">TUAN Marketplace</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Discover trusted providers, compare offers clearly, and place orders with confidence.
        </p>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Freelancers, ICT companies, and agencies can showcase services and products to clients ready to buy.
        </p>
        {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
      </div>

      {/* Navigation Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Link to="/marketplace/search" className="btn-ghost text-xs text-center">
          🔍 Advanced Search
        </Link>
        <Link to="/marketplace/create" className="btn-ghost text-xs text-center">
          ➕ Create Listing
        </Link>
        <Link to="/marketplace/provider" className="btn-ghost text-xs text-center">
          👤 My Dashboard
        </Link>
        <Link to="/marketplace/analytics" className="btn-ghost text-xs text-center">
          📊 Analytics
        </Link>
        <Link to="/marketplace/onboarding" className="btn-ghost text-xs text-center">
          ✓ Become Verified
        </Link>
        <Link to="/marketplace/verification-admin" className="btn-ghost text-xs text-center">
          ⚙️ Verification
        </Link>
        <Link to="/marketplace/disputes" className="btn-ghost text-xs text-center">
          ⚖️ Disputes
        </Link>
        <Link to="/marketplace/commissions" className="btn-ghost text-xs text-center">
          💰 Commissions
        </Link>
        <Link to="/marketplace/payouts" className="btn-ghost text-xs text-center">
          💸 Payouts
        </Link>
        <Link to="/marketplace/fraud-detection" className="btn-ghost text-xs text-center">
          🚨 Fraud Detection
        </Link>
        <Link to="/marketplace/audit-logs" className="btn-ghost text-xs text-center">
          📋 Audit Logs
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {listings.map((item) => (
          <article key={item.id} className="card card-hover">
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-[var(--line)] px-2 py-1 text-xs text-[var(--text-soft)]">{item.type}</span>
              <span className={`text-xs ${item.verified ? "text-emerald-300" : "text-amber-300"}`}>
                {item.verified ? "Verified Provider" : "Pending Verification"}
              </span>
            </div>
            <h3 className="mt-3 font-display text-xl">
              <Link to={`/marketplace/listing/${item.id}`} className="underline">
                {item.name}
              </Link>
            </h3>
            <p className="mt-2 text-sm text-[var(--text-soft)]">{item.provider}</p>
            <p className="mt-4 text-lg text-[var(--gold)]">{item.price}</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">Verified profiles help clients transact safely</p>
            <div className="mt-4 flex gap-2">
              <button className="btn-primary text-xs" onClick={() => handleAction("marketplace.order", item.id)}>
                Order
              </button>
              <button className="btn-ghost text-xs" onClick={() => handleAction("marketplace.track", item.id)}>
                Track
              </button>
              <button className="btn-ghost text-xs" onClick={() => handleAction("marketplace.review", item.id)}>
                Review
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
