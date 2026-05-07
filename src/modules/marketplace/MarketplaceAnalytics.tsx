import { useEffect, useState } from "react";
import { getMarketplaceAnalytics } from "../../services/api";

export default function MarketplaceAnalytics() {
  const [analytics, setAnalytics] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    ordersByStatus: [] as any[],
    topListings: [] as any[],
    topProviders: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getMarketplaceAnalytics().then((data) => {
      if (!mounted) return;
      setAnalytics(data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="card">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card text-center">
          <div className="text-2xl font-display text-[var(--gold)]">{analytics.totalOrders}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Total Orders</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-[var(--gold)]">${(analytics.totalRevenue || 0).toFixed(0)}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Total Revenue</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-[var(--gold)]">${(analytics.avgOrderValue || 0).toFixed(0)}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Avg Order Value</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-display text-[var(--gold)]">{analytics.topProviders.length}</div>
          <div className="text-xs mt-1 text-[var(--text-soft)]">Providers</div>
        </div>
      </div>

      {/* Orders by Status */}
      <div className="card">
        <h3 className="font-display text-sm mb-4">Orders by Status</h3>
        <div className="space-y-2">
          {analytics.ordersByStatus.length > 0 ? (
            analytics.ordersByStatus.map((item) => (
              <div key={item._id} className="flex items-center justify-between text-xs">
                <span className="capitalize">{item._id || "unknown"}</span>
                <span className="text-[var(--gold)] font-semibold">{item.count}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-[var(--text-soft)]">No orders yet</p>
          )}
        </div>
      </div>

      {/* Top Listings */}
      <div className="card">
        <h3 className="font-display text-sm mb-4">Top Listings</h3>
        <div className="space-y-2">
          {analytics.topListings.length > 0 ? (
            analytics.topListings.map((item) => (
              <div key={item._id} className="text-xs p-2 bg-[var(--line)]/20 rounded">
                <div className="font-semibold">Listing #{item._id}</div>
                <div className="text-[var(--text-soft)]">
                  Rating: {(item.avgRating || 0).toFixed(1)}/5 ({item.reviewCount} reviews)
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-[var(--text-soft)]">No reviews yet</p>
          )}
        </div>
      </div>

      {/* Top Providers */}
      <div className="card">
        <h3 className="font-display text-sm mb-4">Top Providers</h3>
        <div className="space-y-2">
          {analytics.topProviders.length > 0 ? (
            analytics.topProviders.map((item) => (
              <div key={item._id} className="text-xs p-2 bg-[var(--line)]/20 rounded">
                <div className="font-semibold">Provider #{item._id}</div>
                <div className="text-[var(--text-soft)]">{item.listingCount} listings</div>
              </div>
            ))
          ) : (
            <p className="text-xs text-[var(--text-soft)]">No providers yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
