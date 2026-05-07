import { useEffect, useState } from "react";
import { getListingReviews, createReview, type Review } from "../../services/api";

export default function ReviewSection({ listingId }: { listingId: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [form, setForm] = useState({ rating: 5, title: "", body: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    getListingReviews(listingId)
      .then((r) => {
        if (!mounted) return;
        setReviews(r.reviews);
      });
    return () => {
      mounted = false;
    };
  }, [listingId]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const review = await createReview(listingId, {
        rating: Number(form.rating),
        title: form.title,
        body: form.body,
      });
      setReviews([review as any, ...reviews]);
      setForm({ rating: 5, title: "", body: "" });
      setMessage("✓ Review submitted for moderation");
    } catch (err: any) {
      setMessage(`✗ ${err?.message || "Failed to submit review"}`);
    } finally {
      setLoading(false);
    }
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-display text-lg">Reviews ({reviews.length})</h3>
        {reviews.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="text-2xl font-display text-[var(--gold)]">{avgRating}</div>
            <div className="text-sm text-[var(--text-soft)]">/ 5.0</div>
          </div>
        )}
      </div>

      <form className="card space-y-4" onSubmit={handleSubmit}>
        <h4 className="font-display text-sm">Leave a Review</h4>

        <label className="block">
          <div className="label">Rating</div>
          <select
            className="input"
            value={form.rating}
            onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
          >
            <option value={1}>1 - Poor</option>
            <option value={2}>2 - Fair</option>
            <option value={3}>3 - Good</option>
            <option value={4}>4 - Very Good</option>
            <option value={5}>5 - Excellent</option>
          </select>
        </label>

        <label className="block">
          <div className="label">Title</div>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Brief summary..."
            required
          />
        </label>

        <label className="block">
          <div className="label">Review</div>
          <textarea
            className="input"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Share your experience..."
            required
          />
        </label>

        <button className="btn-primary text-xs" type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit Review"}
        </button>

        {message && <p className="text-sm">{message}</p>}
      </form>

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r._id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-sm">{r.title}</strong>
                <div className="text-xs text-[var(--text-soft)]">{r.authorName}</div>
              </div>
              <div className="text-[var(--gold)]">{"★".repeat(r.rating)}</div>
            </div>
            <p className="mt-2 text-sm">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
