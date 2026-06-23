import { safeStorage } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProviderId } from "../shared/types";

type SecretEncoding = "safeStorage" | "plain";

interface StoredSecret {
  encoding: SecretEncoding;
  value: string;
}

type SecretsFile = Partial<Record<ProviderId, StoredSecret>>;

export class SecretsVault {
  private readonly filePath: string;

  private constructor(private readonly rootPath: string) {
    this.filePath = path.join(rootPath, "secrets.json");
  }

  static async create(rootPath: string): Promise<SecretsVault> {
    await mkdir(rootPath, { recursive: true });
    return new SecretsVault(rootPath);
  }

  async has(provider: ProviderId): Promise<boolean> {
    const secrets = await this.readAll();
    return Boolean(secrets[provider]?.value);
  }

  async read(provider: ProviderId): Promise<string | undefined> {
    const secrets = await this.readAll();
    const secret = secrets[provider];

    if (!secret?.value) {
      return undefined;
    }

    if (secret.encoding === "safeStorage" && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(secret.value, "base64"));
    }

    return secret.value;
  }

  async write(provider: ProviderId, apiKey: string): Promise<void> {
    const secrets = await this.readAll();
    const trimmed = apiKey.trim();

    if (!trimmed) {
      return;
    }

    if (safeStorage.isEncryptionAvailable()) {
      secrets[provider] = {
        encoding: "safeStorage",
        value: safeStorage.encryptString(trimmed).toString("base64")
      };
    } else {
      secrets[provider] = {
        encoding: "plain",
        value: trimmed
      };
    }

    await this.writeAll(secrets);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }

  private async readAll(): Promise<SecretsFile> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as SecretsFile;
    } catch {
      return {};
    }
  }

  private async writeAll(secrets: SecretsFile): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
    await writeFile(this.filePath, JSON.stringify(secrets, null, 2), "utf8");
  }
}
