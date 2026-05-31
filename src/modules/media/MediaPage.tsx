import { useEffect, useState } from "react";
import { followMediaChannel, getMediaChannels, type MediaChannel } from "../../services/api";

export default function MediaPage() {
  const [channels, setChannels] = useState<MediaChannel[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getMediaChannels().then((items) => {
      if (!isMounted) return;
      setChannels(items);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFollow = async (channelId: number, channelName: string) => {
    try {
      const response = await followMediaChannel(channelId);
      setChannels((prev) => prev.map((channel) => (channel.id === channelId ? response.channel : channel)));
      setMessage(`Followed ${channelName}. The broadcaster page now reflects the updated audience count.`);
    } catch {
      setMessage(`Could not follow ${channelName} right now.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-display text-2xl">Live Media</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Watch live shows, replay episodes, and follow channels that matter to your goals.
        </p>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          Live Media supports student learning, partner visibility, client education, and investor insight.
        </p>
        {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
      </div>

      <div className="card">
        <div className="aspect-video rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[var(--panel)] to-[color:rgba(220,173,75,0.12)] p-6">
          <p className="text-sm text-[var(--text-soft)]">Live now</p>
          <h3 className="mt-2 font-display text-2xl">Africa Tech Frontlines</h3>
          <p className="mt-3 max-w-lg text-sm text-[var(--text-soft)]">Live programs appear here, and each broadcast stays available for easy replay.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {channels.map((channel) => (
          <article key={channel.name} className="card card-hover">
            <h3 className="font-display text-xl">{channel.name}</h3>
            <p className="mt-2 text-sm text-[var(--text-soft)]">{channel.audience}</p>
            <p className="mt-2 text-sm text-[var(--gold)]">{channel.status}</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">{channel.recordingCount} broadcasts archived on this broadcaster page</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">Featured broadcast: {channel.featuredBroadcast}</p>
            <div className="mt-4 flex items-center gap-2">
              <button className="btn-ghost text-xs" onClick={() => handleFollow(channel.id, channel.name)}>
                Follow Channel
              </button>
              <a className="text-xs text-[var(--gold)] hover:underline" href={channel.recordingUrl ?? "/media"}>
                Open broadcaster page
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
