import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { searchListings, type Listing } from "../../services/api";

export default function AdvancedSearch() {
  const [results, setResults] = useState<Listing[]>([]);
  const [filters, setFilters] = useState({
    q: "",
    category: "",
    minPrice: "",
    maxPrice: "",
    verified: false,
    sort: "popularity",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    handleSearch();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const query = {
        ...(filters.q && { q: filters.q }),
        ...(filters.category && { category: filters.category }),
        ...(filters.minPrice && { minPrice: Number(filters.minPrice) }),
        ...(filters.maxPrice && { maxPrice: Number(filters.maxPrice) }),
        ...(filters.verified && { verified: true }),
        sort: filters.sort,
      };
      const listings = await searchListings(query);
      setResults(listings);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    "software",
    "design",
    "marketing",
    "consulting",
    "development",
    "writing",
  ];

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <div className="card">
        <h2 className="font-display text-lg mb-4">Advanced Search</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label className="block">
            <div className="label">Search Query</div>
            <input
              className="input"
              placeholder="Search services, products..."
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </label>

          <label className="block">
            <div className="label">Category</div>
            <select
              className="input"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="label">Min Price ($)</div>
            <input
              className="input"
              type="number"
              placeholder="0"
              value={filters.minPrice}
              onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
            />
          </label>

          <label className="block">
            <div className="label">Max Price ($)</div>
            <input
              className="input"
              type="number"
              placeholder="10000"
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
            />
          </label>

          <label className="block">
            <div className="label">Sort By</div>
            <select
              className="input"
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            >
              <option value="popularity">Most Popular</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest</option>
            </select>
          </label>

          <label className="flex items-end h-full">
            <input
              type="checkbox"
              checked={filters.verified}
              onChange={(e) => setFilters({ ...filters, verified: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm">Verified Providers Only</span>
          </label>
        </div>

        <button className="btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Results */}
      <div>
        <h3 className="font-display text-sm mb-4">
          Results ({results.length})
        </h3>

        {results.length === 0 ? (
          <div className="card text-center text-[var(--text-soft)] text-sm">
            No listings found matching your criteria
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((listing) => (
              <Link
                key={listing.id}
                to={`/marketplace/listing/${listing.id}`}
                className="card hover:bg-[var(--line)]/10 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-display text-sm line-clamp-2">
                      {listing.name}
                    </h4>
                    <p className="text-xs text-[var(--text-soft)] mt-1 line-clamp-2">
                      {listing.shortDesc}
                    </p>
                  </div>
                  {listing.verified && (
                    <span className="text-xs bg-[var(--gold)]/20 text-[var(--gold)] px-2 py-1 rounded ml-2">
                      ✓ Verified
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--line)]">
                  <span className="text-lg font-display text-[var(--gold)]">
                    ${listing.price}
                  </span>
                  <span className="text-xs text-[var(--text-soft)]">
                    {listing.type}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
