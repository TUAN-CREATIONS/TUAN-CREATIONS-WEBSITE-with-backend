import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getListing, createOrder, type Listing, type Order } from "../../services/api";
import ReviewSection from "./ReviewSection";

export default function ListingDetail() {
  const { listingId: idParam } = useParams<{ listingId: string }>();
  const listingId = idParam ? Number(idParam) : 0;
  const [listing, setListing] = useState<Listing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!listingId) return;
    setLoading(true);
    getListing(listingId)
      .then((l) => {
        if (!mounted) return;
        setListing(l as Listing);
      })
      .catch(() => {
        if (!mounted) return;
        setMessage("Listing not found");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [listingId]);

  const handleOrder = async () => {
    if (!listing) return;
    try {
      const priceNum = Number(listing.price.replace(/[^0-9.]/g, "")) || 0;
      const order = (await createOrder({ listingId: listing.id, amount: priceNum, currency: listing.currency ?? "USD" })) as Order;
      setMessage(`✓ Order created: ${order.id}`);
    } catch (e: any) {
      setMessage(`✗ ${e?.message || "Could not create order. Please sign in or try later."}`);
    }
  };

  if (loading) return <div className="card">Loading listing…</div>;
  if (!listing) return <div className="card text-amber-300">Listing not found or an error occurred</div>;

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{listing.name}</h2>
          <span className="text-sm text-[var(--text-soft)]">{listing.type}</span>
        </div>

        <p className="text-sm text-[var(--text-soft)]">{listing.shortDesc}</p>
        {listing.description && <p className="mt-2 text-sm">{listing.description}</p>}

        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <strong className="text-lg text-[var(--gold)]">{listing.currency} {listing.price}</strong>
          <div className="mt-2 text-xs text-[var(--text-soft)]">Provider: {listing.provider}</div>
        </div>

        <div className="mt-6 flex gap-2">
          <button className="btn-primary" onClick={handleOrder}>
            Place Order
          </button>
          <button className="btn-ghost" onClick={() => window.history.back()}>
            Back
          </button>
        </div>

        {message && <p className="mt-3 text-sm">{message}</p>}
      </div>

      <ReviewSection listingId={listing.id} />
    </div>
  );
}
