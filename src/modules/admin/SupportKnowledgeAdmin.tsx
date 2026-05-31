import { useEffect, useMemo, useState } from "react";
import {
  deleteSupportKnowledgeItem,
  getAdminSupportKnowledge,
  saveSupportKnowledgeItem,
  type SupportKnowledgeItem,
} from "../../services/api";
import { extractSupportAttachmentText, inferSupportKnowledgeType, readFileAsDataUrl } from "../../components/support/supportInputUtils";

type SupportKnowledgeFormState = {
  title: string;
  type: SupportKnowledgeItem["type"];
  summary: string;
  contentText: string;
  mediaUrl: string;
  keywords: string;
  order: number;
  isActive: boolean;
};

const emptyFormState: SupportKnowledgeFormState = {
  title: "",
  type: "text",
  summary: "",
  contentText: "",
  mediaUrl: "",
  keywords: "",
  order: 0,
  isActive: true,
};

export default function SupportKnowledgeAdmin() {
  const [items, setItems] = useState<SupportKnowledgeItem[]>([]);
  const [form, setForm] = useState<SupportKnowledgeFormState>(emptyFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      setItems(await getAdminSupportKnowledge());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load support knowledge.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const sortedItems = useMemo(() => [...items].sort((left, right) => left.order - right.order), [items]);

  const resetForm = () => {
    setForm(emptyFormState);
    setEditingId(null);
  };

  const handleEdit = (item: SupportKnowledgeItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      type: item.type,
      summary: item.summary,
      contentText: item.contentText,
      mediaUrl: item.mediaUrl ?? "",
      keywords: item.keywords.join(", "),
      order: item.order,
      isActive: item.isActive,
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this support knowledge item?")) {
      return;
    }

    const deleted = await deleteSupportKnowledgeItem(id);
    if (deleted) {
      setSuccess("Support knowledge item deleted.");
      setItems((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        resetForm();
      }
    } else {
      setError("Unable to delete the support knowledge item.");
    }
  };

  const handleAttachmentChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    setError(null);
    const extracted = await extractSupportAttachmentText(file);
    const dataUrl = await readFileAsDataUrl(file);

    setForm((current) => ({
      ...current,
      title: current.title || file.name.replace(/\.[^.]+$/, ""),
      type: inferSupportKnowledgeType(file),
      summary: current.summary || `Imported from ${file.name}`,
      contentText: extracted.text || current.contentText,
      mediaUrl: dataUrl,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const savedItem = await saveSupportKnowledgeItem({
        id: editingId ?? undefined,
        title: form.title.trim(),
        type: form.type,
        summary: form.summary.trim(),
        contentText: form.contentText.trim(),
        mediaUrl: form.mediaUrl.trim() || null,
        keywords: form.keywords.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
        order: form.order,
        isActive: form.isActive,
      });

      if (!savedItem) {
        throw new Error("Support knowledge item could not be saved.");
      }

      setSuccess(editingId ? "Support knowledge item updated." : "Support knowledge item added.");
      await loadItems();
      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save support knowledge.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="card space-y-5">
      <div>
        <h3 className="font-display text-2xl">Support Knowledge Bot</h3>
        <p className="text-sm text-[var(--text-soft)]">
          Feed the chatbot text, PDFs, images, or videos. For videos, add a transcript or summary so the bot can answer instantly.
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {success && <div className="rounded-xl border border-green-400/40 bg-green-500/10 p-4 text-sm text-green-200">{success}</div>}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-label">
              Title
              <input
                className="field-input"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Live session policy"
              />
            </label>

            <label className="field-label">
              Content Type
              <select
                className="field-input"
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as SupportKnowledgeItem["type"] }))}
              >
                <option value="text">Text</option>
                <option value="pdf">PDF</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-label">
              Summary
              <textarea
                className="field-input min-h-24"
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Short human-readable summary"
              />
            </label>

            <label className="field-label">
              Indexed Answer Text
              <textarea
                className="field-input min-h-24"
                value={form.contentText}
                onChange={(event) => setForm((current) => ({ ...current, contentText: event.target.value }))}
                placeholder="The text the bot should search and quote back"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-label">
              Keywords
              <input
                className="field-input"
                value={form.keywords}
                onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
                placeholder="live session, enrollment, admin"
              />
            </label>

            <label className="field-label">
              Media URL or Data URL
              <input
                className="field-input"
                value={form.mediaUrl}
                onChange={(event) => setForm((current) => ({ ...current, mediaUrl: event.target.value }))}
                placeholder="Optional file or asset reference"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-label">
              Sort Order
              <input
                type="number"
                className="field-input"
                value={form.order}
                onChange={(event) => setForm((current) => ({ ...current, order: Number(event.target.value) || 0 }))}
              />
            </label>

            <label className="field-label">
              Import File
              <input
                type="file"
                className="field-input"
                accept=".pdf,image/*,.txt,.md,.csv,video/*"
                onChange={async (event) => {
                  await handleAttachmentChange(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Publish this item to the chatbot
          </label>

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update Item" : "Save Item"}
            </button>
            <button className="btn-ghost" type="button" onClick={resetForm}>
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <h4 className="font-display text-xl">Active Support Library</h4>
          {isLoading ? (
            <p className="text-sm text-[var(--text-soft)]">Loading support items...</p>
          ) : sortedItems.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">No support knowledge added yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--text)]">{item.title}</p>
                      <p className="text-xs uppercase tracking-wide text-[var(--text-soft)]">{item.type} • order {item.order} • {item.isActive ? "published" : "hidden"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-ghost text-xs" type="button" onClick={() => handleEdit(item)}>Edit</button>
                      <button className="btn-ghost text-xs" type="button" onClick={() => handleDelete(item.id)}>Delete</button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-soft)]">{item.summary || item.contentText}</p>
                  {item.keywords.length > 0 && <p className="mt-3 text-xs text-[var(--text-soft)]">Keywords: {item.keywords.join(", ")}</p>}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
