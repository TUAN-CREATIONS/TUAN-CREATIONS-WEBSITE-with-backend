import { useState } from "react";
import { createListing, type Listing } from "../../services/api";

export default function CreateListing() {
  const [form, setForm] = useState<Partial<Listing>>({ id: Date.now() % 100000, name: "", type: "Service", price: "", shortDesc: "" });
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const payload: Partial<Listing> & { id: number } = {
        id: Number(form.id),
        name: String(form.name || "Untitled"),
        type: (form.type as any) || "Service",
        price: String(form.price || "From $0"),
        shortDesc: String(form.shortDesc || ""),
        description: String(form.description || ""),
      };

      const listing = await createListing(payload);
      setMessage(`Created listing ${listing.id}`);
    } catch (err: any) {
      setMessage(err?.message || "Failed to create listing");
    }
  };

  return (
    <form className="card space-y-4" onSubmit={handleSubmit}>
      <h3 className="font-display text-xl">Create Listing</h3>
      <label className="block">
        <div className="label">Title</div>
        <input className="input" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
      </label>

      <label className="block">
        <div className="label">Type</div>
        <select className="input" value={form.type} onChange={(e) => handleChange("type", e.target.value)}>
          <option>Service</option>
          <option>Product</option>
        </select>
      </label>

      <label className="block">
        <div className="label">Price</div>
        <input className="input" value={form.price} onChange={(e) => handleChange("price", e.target.value)} />
      </label>

      <label className="block">
        <div className="label">Short description</div>
        <textarea className="input" value={form.shortDesc} onChange={(e) => handleChange("shortDesc", e.target.value)} />
      </label>

      <div className="flex gap-2">
        <button className="btn-primary" type="submit">Create</button>
      </div>

      {message && <p className="mt-2 text-sm">{message}</p>}
    </form>
  );
}
