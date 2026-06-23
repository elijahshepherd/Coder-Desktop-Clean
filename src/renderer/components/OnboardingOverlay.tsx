import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { UserProfile } from "../../shared/types";
import { CoderMark } from "./CoderMark";

interface OnboardingOverlayProps {
  onComplete: (profile: Partial<UserProfile>) => Promise<void> | void;
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [phase, setPhase] = useState<"intro" | "form">("intro");
  const [preferredName, setPreferredName] = useState("");
  const [workFocus, setWorkFocus] = useState("");
  const [interests, setInterests] = useState("");
  const [styleNotes, setStyleNotes] = useState("");
  const canSave = preferredName.trim().length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase("form"), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  const save = () => {
    if (!canSave) {
      return;
    }

    void onComplete({
      onboardingCompleted: true,
      preferredName: preferredName.trim(),
      workFocus: workFocus.trim(),
      interests: interests.trim(),
      styleNotes: styleNotes.trim()
    });
  };

  return (
    <div className={`onboarding-scrim ${phase}`} role="presentation">
      <section className={`onboarding-card ${phase}`} role="dialog" aria-label="Set up your profile" aria-modal="true">
        {phase === "intro" ? (
          <CoderMark className="onboarding-intro-mark" size={74} />
        ) : (
          <>
            <div className="onboarding-copy">
              <h2>Set up your profile</h2>
              <p>
                Save a small local profile so Coder Desktop can speak to you naturally. This stays on this computer and is
                mainly used for your preferred name.
              </p>
            </div>

            <div className="onboarding-fields">
              <label className="field">
                <span>What should I call you?</span>
                <input value={preferredName} onChange={(event) => setPreferredName(event.target.value)} placeholder="Your preferred name" />
              </label>
              <label className="field">
                <span>What do you usually work on?</span>
                <input value={workFocus} onChange={(event) => setWorkFocus(event.target.value)} placeholder="Games, apps, bots, websites" />
              </label>
              <label className="field">
                <span>What do you like?</span>
                <input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Topics, tools, or styles" />
              </label>
              <label className="field">
                <span>Anything else I should know?</span>
                <textarea
                  value={styleNotes}
                  onChange={(event) => setStyleNotes(event.target.value)}
                  placeholder="Optional talking style or preferences"
                  rows={3}
                />
              </label>
            </div>

            <button className="primary-button onboarding-save" type="button" disabled={!canSave} onClick={save}>
              <span>Save profile</span>
              <ArrowRight size={15} />
            </button>
          </>
        )}
      </section>
    </div>
  );
}
