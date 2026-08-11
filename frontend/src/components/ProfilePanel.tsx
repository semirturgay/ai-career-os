import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Profile } from "../types";
import { Button, Card, Field, Input, Textarea } from "./ui";

interface ProfilePanelProps {
  selectedId: string | null;
  onSelect: (profile: Profile) => void;
  onSaved: (profile: Profile) => void;
}

export function ProfilePanel({ selectedId, onSelect, onSaved }: ProfilePanelProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.profiles.list().then(setProfiles).catch(console.error);
  }, []);

  useEffect(() => {
    const profile = profiles.find((p) => p.id === selectedId);
    if (profile) {
      setName(profile.name);
      setHeadline(profile.headline ?? "");
      setResumeText(profile.resume_text);
    }
  }, [selectedId, profiles]);

  async function handleSave() {
    if (!name.trim() || !resumeText.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        headline: headline.trim() || undefined,
        resume_text: resumeText.trim(),
      };
      const saved = selectedId
        ? await api.profiles.update(selectedId, payload)
        : await api.profiles.create(payload);
      setProfiles((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        return exists
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev];
      });
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  }

  function handleNew() {
    onSelect({
      id: "",
      name: "",
      headline: null,
      resume_text: "",
      structured_data: null,
      radar_target: null,
      created_at: "",
      updated_at: "",
    });
    setName("");
    setHeadline("");
    setResumeText("");
  }

  return (
    <Card
      title="Profile"
      description="Your resume — the source of truth for matching"
      action={
        profiles.length > 0 ? (
          <select
            value={selectedId ?? ""}
            onChange={(e) => {
              if (!e.target.value) {
                handleNew();
                return;
              }
              const profile = profiles.find((p) => p.id === e.target.value);
              if (profile) onSelect(profile);
            }}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
          >
            <option value="">New profile</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : undefined
      }
    >
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
        />
      </Field>
      <Field label="Headline" hint="Optional — e.g. Senior Backend Engineer">
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Senior Backend Engineer · 10+ years Python"
        />
      </Field>
      <Field label="Resume">
        <Textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your resume text here..."
          rows={12}
        />
      </Field>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving} disabled={!name.trim() || !resumeText.trim()}>
          {selectedId ? "Update profile" : "Save profile"}
        </Button>
        {selectedId && (
          <Button variant="ghost" onClick={handleNew}>
            New
          </Button>
        )}
      </div>
    </Card>
  );
}
