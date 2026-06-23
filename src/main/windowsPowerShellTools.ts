import type { ShellResult, WindowsPowerShellActivity } from "../shared/types";
import { extractCoderToolPayloads, stripCoderToolMarkup } from "./coderToolMarkup";

export interface WindowsPowerShellPlan {
  command: string;
  activity: WindowsPowerShellActivity;
}

interface CommandProfile {
  group: string;
  title: string;
  description: string;
}

const commandProfiles: Record<string, CommandProfile> = {
  systeminfo: {
    group: "System",
    title: "Getting system information",
    description: "Reading Windows, processor, memory, and machine details."
  },
  "get-computerinfo": {
    group: "System",
    title: "Getting computer information",
    description: "Reading Windows and hardware details from PowerShell."
  },
  "get-ciminstance": {
    group: "System",
    title: "Getting hardware information",
    description: "Reading hardware details from Windows Management Instrumentation."
  },
  hostname: {
    group: "System",
    title: "Getting computer name",
    description: "Reading the local machine name."
  },
  ver: {
    group: "System",
    title: "Getting Windows version",
    description: "Reading the installed Windows version."
  },
  whoami: {
    group: "Identity",
    title: "Getting current user",
    description: "Reading the signed-in Windows account name."
  },
  ipconfig: {
    group: "Network",
    title: "Checking network configuration",
    description: "Reading local IP, adapter, and DNS details."
  },
  ping: {
    group: "Network",
    title: "Testing network reachability",
    description: "Checking whether a host responds over the network."
  },
  nslookup: {
    group: "Network",
    title: "Looking up DNS information",
    description: "Resolving a domain or host through DNS."
  },
  netstat: {
    group: "Network",
    title: "Checking network connections",
    description: "Reading active local network connections."
  },
  "test-netconnection": {
    group: "Network",
    title: "Testing network connection",
    description: "Checking network reachability and port status."
  },
  tasklist: {
    group: "Processes",
    title: "Listing running processes",
    description: "Reading active processes on this computer."
  },
  "get-process": {
    group: "Processes",
    title: "Checking running processes",
    description: "Reading active PowerShell process information."
  },
  "get-service": {
    group: "Services",
    title: "Checking Windows services",
    description: "Reading service names and current states."
  },
  "get-date": {
    group: "System",
    title: "Getting date and time",
    description: "Reading the local system date and time."
  },
  "get-location": {
    group: "Workspace",
    title: "Getting current location",
    description: "Reading the current command working directory."
  },
  "get-childitem": {
    group: "Files",
    title: "Listing folder contents",
    description: "Reading file and folder names from the selected location."
  },
  dir: {
    group: "Files",
    title: "Listing folder contents",
    description: "Reading file and folder names from the selected location."
  },
  tree: {
    group: "Files",
    title: "Mapping folder structure",
    description: "Reading a folder tree from the selected location."
  },
  driverquery: {
    group: "Drivers",
    title: "Checking installed drivers",
    description: "Reading installed Windows driver information."
  },
  powercfg: {
    group: "Power",
    title: "Checking power configuration",
    description: "Reading Windows power and battery configuration."
  },
  "get-netadapter": {
    group: "Network",
    title: "Checking network adapters",
    description: "Reading local network adapter details."
  },
  "get-netipaddress": {
    group: "Network",
    title: "Checking IP addresses",
    description: "Reading local IP address assignments."
  },
  "get-eventlog": {
    group: "Logs",
    title: "Reading event logs",
    description: "Reading Windows event log entries."
  },
  "get-winevent": {
    group: "Logs",
    title: "Reading Windows events",
    description: "Reading Windows event records."
  }
};

const approvedInformationCommands = new Set([
  "systeminfo",
  "get-computerinfo",
  "get-ciminstance",
  "hostname",
  "ver",
  "whoami",
  "ipconfig",
  "ping",
  "nslookup",
  "netstat",
  "test-netconnection",
  "tasklist",
  "get-process",
  "get-service",
  "get-date",
  "get-location",
  "get-childitem",
  "dir",
  "tree",
  "driverquery",
  "powercfg",
  "get-netadapter",
  "get-netipaddress",
  "get-eventlog",
  "get-winevent"
]);

const pastedCommandCatalog = new Set(
  [
    "arp",
    "assoc",
    "attrib",
    "auditpol",
    "appwiz.cpl",
    "add-printer",
    "add-content",
    "add-computer",
    "add-localgroupmember",
    "add-type",
    "add-appxpackage",
    "add-mppreference",
    "add-netfirewallrule",
    "add-vpnconnection",
    "add-printerport",
    "add-history",
    "add-member",
    "add-bitsfile",
    "add-dnsclientnrptrule",
    "add-jobtrigger",
    "bcdedit",
    "bitsadmin",
    "break",
    "backup-gpo",
    "backup-volume",
    "backup-eventlog",
    "backup-computer",
    "backup-vm",
    "backup-dhcpserver",
    "backup-registry",
    "backup-certificate",
    "backup-cluster",
    "backup-printer",
    "backup-webconfiguration",
    "backup-systemstate",
    "backup-sqldatabase",
    "block-fileshareaccess",
    "block-smbshareaccess",
    "build-module",
    "backup-bitlockerkeyprotector",
    "cd",
    "cls",
    "chkdsk",
    "cipher",
    "comp",
    "compact",
    "control",
    "cmdkey",
    "clip",
    "certutil",
    "copy",
    "curl",
    "clear-host",
    "clear-content",
    "clear-history",
    "clear-recyclebin",
    "compare-object",
    "compress-archive",
    "convertto-json",
    "convertfrom-json",
    "dir",
    "diskpart",
    "driverquery",
    "dism",
    "defrag",
    "date",
    "del",
    "doskey",
    "diskshadow",
    "dxdiag",
    "debug-process",
    "disable-localuser",
    "disable-netadapter",
    "disable-bitlocker",
    "disable-psremoting",
    "disable-scheduledtask",
    "disable-computerrestore",
    "disable-netfirewallrule",
    "disconnect-pssession",
    "dismount-diskimage",
    "echo",
    "eventvwr",
    "expand",
    "esentutl",
    "explorer",
    "enable-localuser",
    "enable-netadapter",
    "enable-bitlocker",
    "enable-psremoting",
    "enable-scheduledtask",
    "enable-computerrestore",
    "enable-netfirewallrule",
    "enter-pssession",
    "exit",
    "export-csv",
    "export-clixml",
    "expand-archive",
    "enable-mmagent",
    "enable-windowsoptionalfeature",
    "enable-tlsciphersuite",
    "fc",
    "find",
    "findstr",
    "for",
    "forfiles",
    "format",
    "fsutil",
    "find-module",
    "find-package",
    "find-command",
    "find-script",
    "foreach-object",
    "format-table",
    "format-list",
    "format-wide",
    "format-hex",
    "find-process",
    "find-service",
    "find-netroute",
    "find-dnsserverresourcerecord",
    "gpupdate",
    "gpresult",
    "get-help",
    "get-command",
    "get-process",
    "get-service",
    "get-childitem",
    "get-content",
    "get-item",
    "get-itemproperty",
    "get-date",
    "get-history",
    "get-location",
    "get-module",
    "get-alias",
    "get-computerinfo",
    "get-netipaddress",
    "get-netadapter",
    "get-eventlog",
    "get-winevent",
    "get-localuser",
    "hostname",
    "ipconfig",
    "iisreset",
    "icacls",
    "import-module",
    "import-csv",
    "import-clixml",
    "install-module",
    "install-package",
    "invoke-command",
    "invoke-webrequest",
    "invoke-restmethod",
    "invoke-expression",
    "initialize-disk",
    "import-certificate",
    "import-pfxcertificate",
    "install-script",
    "invoke-item",
    "install-windowsfeature",
    "install-windowsupdate",
    "import-alias",
    "klist",
    "kill",
    "logoff",
    "mkdir",
    "more",
    "mountvol",
    "mode",
    "move",
    "msg",
    "measure-object",
    "measure-command",
    "move-item",
    "move-itemproperty",
    "mount-diskimage",
    "mount-volume",
    "mount-vhd",
    "net",
    "netstat",
    "nslookup",
    "nbtstat",
    "netsh",
    "new-item",
    "new-object",
    "new-alias",
    "new-variable",
    "new-module",
    "new-psdrive",
    "new-itemproperty",
    "new-localuser",
    "new-netfirewallrule",
    "new-service",
    "new-scheduledtask",
    "new-pssession",
    "new-eventlog",
    "new-temporaryfile",
    "new-timespan",
    "new-selfsignedcertificate",
    "ping",
    "pathping",
    "powercfg",
    "powershell",
    "print",
    "prompt",
    "popd",
    "pushd",
    "query",
    "quser",
    "qwinsta",
    "robocopy",
    "reg",
    "route",
    "runas",
    "rename",
    "rd",
    "remove-item",
    "rename-item",
    "restart-computer",
    "restart-service",
    "remove-itemproperty",
    "remove-variable",
    "read-host",
    "receive-job",
    "register-objectevent",
    "register-scheduledtask",
    "resolve-path",
    "remove-module",
    "remove-service",
    "remove-localuser",
    "remove-netfirewallrule",
    "repair-volume",
    "systeminfo",
    "sfc",
    "sc",
    "schtasks",
    "shutdown",
    "set",
    "setx",
    "start",
    "sort",
    "subst",
    "set-location",
    "set-content",
    "set-item",
    "set-itemproperty",
    "set-variable",
    "start-process",
    "stop-process",
    "start-service",
    "stop-service",
    "select-string",
    "tasklist",
    "taskkill",
    "tracert",
    "tree",
    "takeown",
    "timeout",
    "type",
    "test-path",
    "test-connection",
    "test-netconnection",
    "tee-object",
    "trace-command",
    "test-computersecurechannel",
    "test-modulemanifest",
    "test-wsman",
    "test-json",
    "test-cluster",
    "test-certificate",
    "test-filecatalog",
    "test-volume",
    "uninstall-module",
    "uninstall-package",
    "unblock-file",
    "update-help",
    "update-module",
    "update-mpsignature",
    "ver",
    "vssadmin",
    "where",
    "whoami",
    "wmic",
    "wevtutil",
    "write-host",
    "write-output",
    "write-error",
    "write-warning",
    "write-verbose",
    "write-debug",
    "write-information",
    "wait-job",
    "wait-process",
    "where-object",
    "xcopy",
    "zip"
  ].map((command) => command.toLowerCase())
);

export function detectWindowsPowerShellPlan(content: string): WindowsPowerShellPlan | null {
  const directCommand = findDirectCommand(content);

  if (directCommand) {
    return createWindowsPowerShellPlan(directCommand);
  }

  const normalized = content.toLowerCase();

  if (/\b(cpu|processor|processors|ram|memory|windows version|system info|system information|computer specs|device specs)\b/.test(normalized)) {
    return createWindowsPowerShellPlan("systeminfo");
  }

  if (/\b(gpu|graphics card|video card|display adapter|dedicated graphics|gta\s*5|game specs)\b/.test(normalized)) {
    return createWindowsPowerShellPlan("Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion");
  }

  if (/\b(current user|signed in|signed-in|who am i|username|account name)\b/.test(normalized)) {
    return createWindowsPowerShellPlan("whoami");
  }

  if (/\b(ip address|network|dns|adapter|wifi|wi-fi|ethernet)\b/.test(normalized)) {
    return createWindowsPowerShellPlan("ipconfig /all");
  }

  if (/\b(process|processes|running apps|task list|tasks)\b/.test(normalized)) {
    return createWindowsPowerShellPlan("tasklist");
  }

  if (/\b(service|services)\b/.test(normalized)) {
    return createWindowsPowerShellPlan("Get-Service | Select-Object -First 40");
  }

  if (/\b(date|time|clock)\b/.test(normalized)) {
    return createWindowsPowerShellPlan("Get-Date");
  }

  return null;
}

export function parseWindowsPowerShellToolRequest(content: string): WindowsPowerShellPlan | null {
  return parseWindowsPowerShellToolRequests(content)[0] ?? null;
}

export function parseWindowsPowerShellToolRequests(content: string): WindowsPowerShellPlan[] {
  const plans: WindowsPowerShellPlan[] = [];

  for (const payload of extractCoderToolPayloads(content)) {
    try {
      const request = JSON.parse(payload) as { type?: unknown; command?: unknown };

      if (request.type !== "windows-ps-group" || typeof request.command !== "string") {
        continue;
      }

      const plan = createWindowsPowerShellPlan(request.command);

      if (plan) {
        plans.push(plan);
      }
    } catch {
      continue;
    }
  }

  return plans;
}

export function createWindowsPowerShellPlan(command: string): WindowsPowerShellPlan | null {
  const commandName = getCommandName(command);

  if (!commandName || !isApprovedInformationCommand(commandName)) {
    return null;
  }

  return {
    command: command.trim(),
    activity: createWindowsPowerShellActivity(command)
  };
}

export function createWindowsPowerShellActivity(command: string, result?: ShellResult): WindowsPowerShellActivity {
  const commandName = getCommandName(command) ?? "powershell";
  const profile = commandProfiles[commandName] ?? createProfileFromCommand(commandName);

  return {
    kind: "windows-ps-group",
    command: command.trim(),
    commandName,
    title: result ? completeTitle(profile.title, result.exitCode === 0) : profile.title,
    description: profile.description,
    group: profile.group,
    result
  };
}

export function formatWindowsPowerShellToolContent(activity: WindowsPowerShellActivity): string {
  const result = activity.result;

  if (!result) {
    return [
      `Windows PowerShell activity: ${activity.title}`,
      `Command: ${activity.command}`,
      `Status: running`
    ].join("\n");
  }

  const output = result.stdout || result.stderr || "No command output.";
  return [
    `Windows PowerShell activity: ${activity.title}`,
    `Command: ${result.command}`,
    `Working directory: ${result.cwd}`,
    `Exit code: ${result.exitCode ?? "unknown"}`,
    "",
    "Output:",
    output.slice(0, 8_000)
  ].join("\n");
}

export function stripCoderToolRequests(content: string): string {
  return stripCoderToolMarkup(content);
}

function findDirectCommand(content: string): string | null {
  const trimmed = content.trim();
  const commandMatch = /(?:^|\b)(?:run|use|execute|try)\s+([a-z][a-z0-9.-]*(?:\s+\/[a-z]+)?)/i.exec(trimmed);
  const directToken = commandMatch?.[1] ?? (/^([a-z][a-z0-9.-]*)(?:\s|$)/i.exec(trimmed)?.[1] || null);

  if (!directToken) {
    return null;
  }

  const commandName = getCommandName(directToken);
  if (!commandName || !pastedCommandCatalog.has(commandName)) {
    return null;
  }

  return commandName === "ipconfig" && /\ball\b/i.test(trimmed) ? "ipconfig /all" : commandName;
}

function getCommandName(command: string): string | null {
  const match = /^\s*([a-zA-Z][a-zA-Z0-9.-]*)/.exec(command);
  return match?.[1]?.toLowerCase() ?? null;
}

function isApprovedInformationCommand(commandName: string): boolean {
  return approvedInformationCommands.has(commandName);
}

function createProfileFromCommand(commandName: string): CommandProfile {
  const words = commandName
    .replace(/^(get|test|find|query|where|write|format|select)-/i, "")
    .replace(/[-.]+/g, " ")
    .trim();
  const label = words ? titleCase(words) : "PowerShell command";

  if (commandName.startsWith("get-")) {
    return {
      group: "PowerShell",
      title: `Getting ${label.toLowerCase()}`,
      description: `Reading ${label.toLowerCase()} from PowerShell.`
    };
  }

  if (commandName.startsWith("test-")) {
    return {
      group: "PowerShell",
      title: `Testing ${label.toLowerCase()}`,
      description: `Checking ${label.toLowerCase()} from PowerShell.`
    };
  }

  return {
    group: "PowerShell",
    title: `Running ${label}`,
    description: `Running ${label} through Windows PowerShell.`
  };
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function completeTitle(title: string, succeeded: boolean): string {
  if (!succeeded) {
    return title
      .replace(/^Getting\b/, "Could not get")
      .replace(/^Checking\b/, "Could not check")
      .replace(/^Testing\b/, "Could not test")
      .replace(/^Listing\b/, "Could not list")
      .replace(/^Reading\b/, "Could not read");
  }

  return title
    .replace(/^Getting\b/, "Got")
    .replace(/^Checking\b/, "Checked")
    .replace(/^Testing\b/, "Tested")
    .replace(/^Listing\b/, "Listed")
    .replace(/^Reading\b/, "Read")
    .replace(/^Mapping\b/, "Mapped");
}
