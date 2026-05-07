import { useEffect, useState } from "react";
import { getListings, getOrders, type Listing, type Order } from "../../services/api";

export default function ProviderDashboard() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<{ buyer: Order[]; provider: Order[] }>({ buyer: [], provider: [] });

  useEffect(() => {
    let mounted = true;
    getListings().then((items) => {
      if (!mounted) return;
      setListings(items);
    });

    getOrders().then((o) => {
      if (!mounted) return;
      setOrders(o as any);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-display text-2xl">Provider Dashboard</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">Manage your listings and view incoming orders.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h3 className="font-display text-lg">Your Listings</h3>
          <ul className="mt-3 space-y-2">
            {listings.map((l) => (
              <li key={l.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-[var(--text-soft)]">{l.shortDesc}</div>
                </div>
                <div className="text-sm text-[var(--gold)]">{l.price}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3 className="font-display text-lg">Orders</h3>
          <ul className="mt-3 space-y-2">
            {orders.provider.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Order {o.id}</div>
                  <div className="text-xs text-[var(--text-soft)]">Listing {o.listingSnapshot?.name}</div>
                </div>
                <div className="text-sm">{o.status}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
