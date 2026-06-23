import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";

interface MaintenanceCommand {
  esid: string;
  of: string;
  al: "ALL" | "Windows" | "macOS";
  note: string;
  issueNumber: number;
  createdAt: string;
}

const maintenanceDirName = "maintenance";
const lockFileName = "active.lock";
const repoOwner = "elijahshepherd";
const repoName = "Coder-Desktop";
const ghExe = process.platform === "win32" ? "gh.exe" : "gh";

function getMaintenanceDir(dataPath: string): string {
  return path.join(dataPath, maintenanceDirName);
}

function getLockFilePath(dataPath: string): string {
  return path.join(getMaintenanceDir(dataPath), lockFileName);
}

export async function readActiveMaintenance(dataPath: string): Promise<MaintenanceCommand | null> {
  const lockPath = getLockFilePath(dataPath);
  if (!existsSync(lockPath)) {
    return null;
  }
  try {
    const content = await readFile(lockPath, "utf8");
    return JSON.parse(content) as MaintenanceCommand;
  } catch {
    await rm(lockPath, { force: true });
    return null;
  }
}

export function hasActiveMaintenance(dataPath: string): boolean {
  return existsSync(getLockFilePath(dataPath));
}

export async function setMaintenanceLock(dataPath: string, command: MaintenanceCommand): Promise<void> {
  const dir = getMaintenanceDir(dataPath);
  await mkdir(dir, { recursive: true });
  await writeFile(getLockFilePath(dataPath), JSON.stringify(command, null, 2), "utf8");
}

export async function clearMaintenanceLock(dataPath: string): Promise<void> {
  await rm(getLockFilePath(dataPath), { force: true });
}

export function parseMaintenanceBody(body: string, issueNumber: number): MaintenanceCommand | null {
  const esidMatch = body.match(/ESID:\s*(\S+)/);
  const ofMatch = body.match(/OF:\s*(\S+)/);
  const alMatch = body.match(/AL:\s*(ALL|Windows|macOS)/);
  const noteMatch = body.match(/NOTE:\s*(.+)/);

  if (!esidMatch || !ofMatch || !alMatch) {
    return null;
  }

  return {
    esid: esidMatch[1],
    of: ofMatch[1],
    al: alMatch[1] as MaintenanceCommand["al"],
    note: noteMatch ? noteMatch[1].trim() : "",
    issueNumber,
    createdAt: new Date().toISOString()
  };
}

export function isMaintenanceIssue(title: string): boolean {
  return /^L:N\s+T:\s+Maintenance/i.test(title.trim());
}

export async function pollMaintenanceIssues(dataPath: string): Promise<MaintenanceCommand | null> {
  return new Promise((resolve) => {
    execFile(ghExe, [
      "issue", "list",
      "--repo", `${repoOwner}/${repoName}`,
      "--state", "open",
      "--limit", "10",
      "--json", "number,title,body"
    ], {
      timeout: 15_000,
      windowsHide: true
    }, async (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }

      try {
        const issues = JSON.parse(stdout) as Array<{ number: number; title: string; body: string }>;

        for (const issue of issues) {
          if (isMaintenanceIssue(issue.title)) {
            const command = parseMaintenanceBody(issue.body, issue.number);
            if (command) {
              const platform = process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "ALL";
              if (command.al === "ALL" || command.al === platform) {
                await setMaintenanceLock(dataPath, command);
                return resolve(command);
              }
            }
          }
        }

        const existing = await readActiveMaintenance(dataPath);
        if (existing) {
          await clearMaintenanceLock(dataPath);
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

export { type MaintenanceCommand };
