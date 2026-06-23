import { Grid3X3, X, ImageIcon, Code2, Globe, Database, Bot } from "lucide-react";
import { useEffect, useState } from "react";

interface SubAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubAppsModal({ isOpen, onClose }: SubAppsModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`settings-modal-scrim${isOpen ? " visible" : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside className="sub-apps-modal" role="dialog" aria-label="Sub Apps">
        <header>
          <Grid3X3 size={18} />
          <h2>Sub Apps</h2>
          <button className="icon-button" type="button" aria-label="Close sub apps" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="sub-apps-grid">
          <button className="sub-app-card" type="button" disabled>
            <span className="sub-app-icon" aria-hidden="true">
              <ImageIcon size={22} />
            </span>
            <strong>Image Studio</strong>
            <small>Coming soon</small>
          </button>
          <button className="sub-app-card" type="button" disabled>
            <span className="sub-app-icon" aria-hidden="true">
              <Code2 size={22} />
            </span>
            <strong>Sandbox</strong>
            <small>Coming soon</small>
          </button>
          <button className="sub-app-card" type="button" disabled>
            <span className="sub-app-icon" aria-hidden="true">
              <Globe size={22} />
            </span>
            <strong>Web Explorer</strong>
            <small>Coming soon</small>
          </button>
          <button className="sub-app-card" type="button" disabled>
            <span className="sub-app-icon" aria-hidden="true">
              <Database size={22} />
            </span>
            <strong>Data Viewer</strong>
            <small>Coming soon</small>
          </button>
          <button className="sub-app-card" type="button" disabled>
            <span className="sub-app-icon" aria-hidden="true">
              <Bot size={22} />
            </span>
            <strong>Agent Hub</strong>
            <small>Coming soon</small>
          </button>
        </div>
      </aside>
    </div>
  );
}
