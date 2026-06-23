import type { SecuritySettings } from "../../shared/types";

interface SecurityPanelProps {
  security: SecuritySettings;
  onChange: (security: SecuritySettings) => void;
  embedded?: boolean;
}

type BooleanSecurityKey = Exclude<keyof SecuritySettings, "accessMode">;

export function SecurityPanel({ security, onChange, embedded = false }: SecurityPanelProps) {
  const update = (key: BooleanSecurityKey, value: boolean) => {
    onChange({
      ...security,
      [key]: value
    });
  };

  return (
    <section className={embedded ? "tool-panel security-panel embedded" : "tool-panel security-panel"}>
      <div className="panel-heading">
        <div>
          <h3>Security</h3>
          <p>Choose what local app behaviors may run</p>
        </div>
      </div>

      <div className="security-list">
        <PermissionSwitch
          checked={security.allowFileRead}
          title="Read files"
          description="Lets Coder Desktop list and read files and folders on this computer."
          onChange={(value) => update("allowFileRead", value)}
        />
        <PermissionSwitch
          checked={security.allowFileEdit}
          title="Edit files"
          description="Allows Coder Desktop to create, edit, and delete files or folders on this computer."
          onChange={(value) => update("allowFileEdit", value)}
        />
        <PermissionSwitch
          checked={security.allowShellExecute}
          title="Shell commands"
          description="Allows commands to run on this computer."
          onChange={(value) => update("allowShellExecute", value)}
        />
        <PermissionSwitch
          checked={security.allowInternetAccess}
          title="Internet access"
          description="Allows Coder Desktop to search the web and read public pages when chat access permits it."
          onChange={(value) => update("allowInternetAccess", value)}
        />
        <PermissionSwitch
          checked={security.requirePermissionPrompts}
          title="Permission prompts"
          description="Keep sensitive actions visible before they run."
          onChange={(value) => update("requirePermissionPrompts", value)}
        />
        <PermissionSwitch
          checked={security.autoContinueOnProviderError}
          title="Auto continue after provider errors"
          description="Try to continue from completed work when a provider times out or fails."
          onChange={(value) => update("autoContinueOnProviderError", value)}
        />
        <PermissionSwitch
          checked={security.showMessageIdentity}
          title="Show message identity"
          description="Shows the You and Coder labels and icons beside chat messages."
          onChange={(value) => update("showMessageIdentity", value)}
        />
      </div>
    </section>
  );
}

interface PermissionSwitchProps {
  checked: boolean;
  title: string;
  description: string;
  onChange: (value: boolean) => void;
}

function PermissionSwitch({ checked, title, description, onChange }: PermissionSwitchProps) {
  return (
    <button
      className={checked ? "permission-switch active" : "permission-switch"}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track" aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}
