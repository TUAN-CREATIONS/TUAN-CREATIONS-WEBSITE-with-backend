import { useEffect, useState } from "react";
import { getAdminSupportConversations, getAdminSupportConversation, claimSupportConversation } from "../../services/api";

export default function SupportConversationsAdmin() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    const list = await getAdminSupportConversations();
    setConversations(list || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const openConversation = async (id: string) => {
    const convo = await getAdminSupportConversation(id);
    setSelected(convo);
  };

  const handleClaim = async () => {
    if (!selected) return;
    const ok = await claimSupportConversation(selected._id);
    if (ok) {
      await load();
      const convo = await getAdminSupportConversation(selected._id);
      setSelected(convo);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">Support conversations</h2>
      <div className="mt-4 flex gap-4">
        <div className="w-1/3">
          <ul>
            {conversations.map((c) => (
              <li key={c.id} className="mb-2">
                <button onClick={() => openConversation(c.id)} className="text-left w-full">
                  <div className="font-medium">{c.userName}</div>
                  <div className="text-sm text-slate-500">{c.summary}</div>
                  <div className="text-xs text-slate-400">{c.status}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1">
          {selected ? (
            <div>
              <h3 className="font-semibold">{selected.userName}</h3>
              <p className="text-sm text-slate-500">{selected.summary}</p>

              <div className="mt-3 space-y-2 max-h-[40vh] overflow-y-auto border p-2">
                {(selected.messages || []).map((m: any, idx: number) => (
                  <div key={idx} className="mb-1">
                    <div className="text-xs text-slate-600">{m.senderName || m.sender} • {new Date(m.time).toLocaleString()}</div>
                    <div className="text-sm">{m.text}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={handleClaim} className="rounded bg-emerald-400 px-3 py-1 text-sm">Claim</button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Select a conversation to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
