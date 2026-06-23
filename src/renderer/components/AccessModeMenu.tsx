import { Check, ChevronDown, Hand, Shield, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AccessMode, SecuritySettings } from "../../shared/types";

interface AccessModeMenuProps {
  security: SecuritySettings;
  onChange: (security: SecuritySettings) => void;
}

interface AccessModeOption {
  id: AccessMode;
  label: string;
  description: string;
  icon: typeof Shield;
}

const accessModeOptions: AccessModeOption[] = [
  {
    id: "ask-approval",
    label: "Ask for approval",
    description: "Always ask before creating edits or using the internet.",
    icon: Hand
  },
  {
    id: "approve",
    label: "Approve for me",
    description: "Only ask for actions detected as potentially unsafe.",
    icon: Shield
  },
  {
    id: "full",
    label: "Full access",
    description: "Allow local tools and internet inside app security boundaries.",
    icon: ShieldAlert
  }
];

export function AccessModeMenu({ security, onChange }: AccessModeMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeOption = accessModeOptions.find((option) => option.id === security.accessMode) ?? accessModeOptions[1];
  const ActiveIcon = activeOption.icon;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const selectMode = (mode: AccessMode) => {
    onChange(securityForAccessMode(security, mode));
    setIsOpen(false);
  };

  return (
    <div className={`access-mode-menu access-${security.accessMode}${isOpen ? " open" : ""}`} ref={menuRef}>
      <button
        className="access-mode-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <ActiveIcon size={14} />
        <span>{activeOption.label}</span>
        <ChevronDown size={13} />
      </button>

      {isOpen ? (
        <div className="access-mode-popover" role="menu">
          <p>How should Coder Desktop actions be approved?</p>
          {accessModeOptions.map((option) => {
            const OptionIcon = option.icon;
            const isSelected = option.id === security.accessMode;

            return (
              <button
                className={isSelected ? "access-mode-option selected" : "access-mode-option"}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                key={option.id}
                onClick={() => selectMode(option.id)}
              >
                <OptionIcon size={15} aria-hidden="true" />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                {isSelected ? <Check size={15} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function securityForAccessMode(security: SecuritySettings, accessMode: AccessMode): SecuritySettings {
  switch (accessMode) {
    case "ask-approval":
      return {
        ...security,
        accessMode,
        allowFileEdit: true,
        allowInternetAccess: true,
        requirePermissionPrompts: true
      };
    case "full":
      return {
        ...security,
        accessMode,
        allowFileRead: true,
        allowFileEdit: true,
        allowShellExecute: true,
        allowInternetAccess: true,
        requirePermissionPrompts: false
      };
    case "approve":
    default:
      return {
        ...security,
        accessMode,
        allowFileRead: true,
        allowFileEdit: true,
        allowShellExecute: true,
        allowInternetAccess: true,
        requirePermissionPrompts: true
      };
  }
}
