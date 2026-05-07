import { useState } from "react";
import { updateProviderProfile, submitVerificationRequest } from "../../services/api";

export default function ProviderOnboarding() {
  const [step, setStep] = useState<"profile" | "verification">("profile");
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    bio: "",
    contact: "",
    website: "",
    skills: "",
  });
  const [verificationForm, setVerificationForm] = useState({
    note: "",
    documents: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleProfileSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProviderProfile({
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        contact: profileForm.contact,
        website: profileForm.website,
        skills: profileForm.skills.split(",").map((s) => s.trim()).filter(s => s),
      });
      setMessage("✓ Profile updated successfully");
      setStep("verification");
    } catch (err: any) {
      setMessage(`✗ ${err?.message || "Failed to update profile"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submitVerificationRequest({
        note: verificationForm.note,
        documents: verificationForm.documents.split("\n").map(d => d.trim()).filter(d => d),
      });
      setMessage("✓ Verification request submitted. Admin will review shortly.");
    } catch (err: any) {
      setMessage(`✗ ${err?.message || "Failed to submit verification"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-display text-2xl">Provider Setup</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">Complete your profile and verify your identity to unlock full marketplace features.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div
          onClick={() => setStep("profile")}
          className={`card cursor-pointer ${step === "profile" ? "border-2 border-[var(--gold)]" : ""}`}
        >
          <h3 className="font-display text-lg">1. Profile</h3>
          <p className="mt-1 text-xs text-[var(--text-soft)]">Set up your provider profile</p>
        </div>
        <div
          onClick={() => setStep("verification")}
          className={`card cursor-pointer ${step === "verification" ? "border-2 border-[var(--gold)]" : ""}`}
        >
          <h3 className="font-display text-lg">2. Verification</h3>
          <p className="mt-1 text-xs text-[var(--text-soft)]">Submit verification documents</p>
        </div>
      </div>

      {step === "profile" && (
        <form className="card space-y-4" onSubmit={handleProfileSubmit}>
          <h3 className="font-display text-lg">Complete Your Profile</h3>

          <label className="block">
            <div className="label">Display Name</div>
            <input
              className="input"
              value={profileForm.displayName}
              onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
              required
            />
          </label>

          <label className="block">
            <div className="label">Bio</div>
            <textarea
              className="input"
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              placeholder="Tell buyers about your expertise..."
            />
          </label>

          <label className="block">
            <div className="label">Contact (email/phone)</div>
            <input
              className="input"
              value={profileForm.contact}
              onChange={(e) => setProfileForm({ ...profileForm, contact: e.target.value })}
            />
          </label>

          <label className="block">
            <div className="label">Website</div>
            <input
              className="input"
              value={profileForm.website}
              onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
              placeholder="https://..."
            />
          </label>

          <label className="block">
            <div className="label">Skills (comma-separated)</div>
            <input
              className="input"
              value={profileForm.skills}
              onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
              placeholder="e.g., Python, UI Design, Digital Marketing"
            />
          </label>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Next: Verification"}
          </button>

          {message && <p className="mt-2 text-sm">{message}</p>}
        </form>
      )}

      {step === "verification" && (
        <form className="card space-y-4" onSubmit={handleVerificationSubmit}>
          <h3 className="font-display text-lg">Submit Verification Documents</h3>
          <p className="text-xs text-[var(--text-soft)]">Provide details and document links for identity verification</p>

          <label className="block">
            <div className="label">Verification Note</div>
            <textarea
              className="input"
              value={verificationForm.note}
              onChange={(e) => setVerificationForm({ ...verificationForm, note: e.target.value })}
              placeholder="Include company registration, tax ID, certifications, etc."
            />
          </label>

          <label className="block">
            <div className="label">Document Links (one per line)</div>
            <textarea
              className="input"
              value={verificationForm.documents}
              onChange={(e) => setVerificationForm({ ...verificationForm, documents: e.target.value })}
              placeholder="https://example.com/doc1&#10;https://example.com/doc2"
              rows={4}
            />
          </label>

          <div className="flex gap-2">
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Verification"}
            </button>
            <button className="btn-ghost" type="button" onClick={() => setStep("profile")}>
              Back
            </button>
          </div>

          {message && <p className="mt-2 text-sm">{message}</p>}
        </form>
      )}
    </div>
  );
}
