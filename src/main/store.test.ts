import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProviderSettings } from "../shared/defaults";
import { createChatTitleFromContent, DesktopStore } from "./store";

vi.mock("electron", () => ({
  safeStorage: {
    decryptString: (value: Buffer) => value.toString("utf8"),
    encryptString: (value: string) => Buffer.from(value, "utf8"),
    isEncryptionAvailable: () => false
  }
}));

describe("desktop store provider secrets", () => {
  let userDataPath: string;

  beforeEach(async () => {
    userDataPath = await mkdtemp(path.join(os.tmpdir(), "coder-desktop-store-"));
  });

  afterEach(async () => {
    await rm(userDataPath, { force: true, recursive: true });
  });

  it("persists API keys across store reloads without exposing them in public state", async () => {
    const firstStore = await DesktopStore.create(userDataPath);

    await firstStore.updateProviders({
      ...defaultProviderSettings,
      activeProvider: "openai",
      openai: {
        ...defaultProviderSettings.openai,
        apiKey: "sk-test-forever"
      }
    });

    const secondStore = await DesktopStore.create(userDataPath);
    const publicState = await secondStore.getPublicState();
    const providersWithSecrets = await secondStore.getProvidersWithSecrets();

    expect(publicState.providers.openai.apiKey).toBe("");
    expect(publicState.providers.openai.hasApiKey).toBe(true);
    expect(providersWithSecrets.openai.apiKey).toBe("sk-test-forever");
  });

  it("persists provider selection and model changes while keeping API keys private", async () => {
    const store = await DesktopStore.create(userDataPath);

    await store.updateProviders({
      ...defaultProviderSettings,
      activeProvider: "claude",
      claude: {
        ...defaultProviderSettings.claude,
        model: "claude-live-model",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: "sk-ant-live"
      }
    });

    const publicState = await store.getPublicState();
    const providersWithSecrets = await store.getProvidersWithSecrets();

    expect(publicState.providers.activeProvider).toBe("claude");
    expect(publicState.providers.claude.model).toBe("claude-live-model");
    expect(publicState.providers.claude.baseUrl).toBe("https://api.anthropic.com/v1");
    expect(publicState.providers.claude.apiKey).toBe("");
    expect(publicState.providers.claude.hasApiKey).toBe(true);
    expect(providersWithSecrets.claude.apiKey).toBe("sk-ant-live");
  });

  it("removes retired add-on settings from public security state", async () => {
    const store = await DesktopStore.create(userDataPath);
    const retiredSetting = ["allow", "Ext", "ensions"].join("");

    await store.updateSecurity({
      accessMode: "approve",
      allowFileRead: true,
      allowFileEdit: true,
      allowShellExecute: true,
      allowInternetAccess: true,
      [retiredSetting]: true,
      requirePermissionPrompts: true,
      autoContinueOnProviderError: false,
      showMessageIdentity: true
    });

    const publicState = await store.getPublicState();

    expect(retiredSetting in publicState.security).toBe(false);
    expect(publicState.security.autoContinueOnProviderError).toBe(false);
    expect(publicState.security.showMessageIdentity).toBe(true);
  });

  it("persists personalization and AI functionality settings with sane limits", async () => {
    const store = await DesktopStore.create(userDataPath);

    await store.updatePersonalization({
      accentTone: "custom",
      customAccentColor: "#fefefe",
      completionAnimation: false,
      completionNotifications: true
    });
    await store.updateAiFunctionality({
      maxLetMeKnows: 20
    });

    const publicState = await store.getPublicState();

    expect(publicState.personalization).toMatchObject({
      accentTone: "custom",
      customAccentColor: "#fefefe",
      completionAnimation: false,
      completionNotifications: true
    });
    expect(publicState.aiFunctionality.maxLetMeKnows).toBe(5);
  });

  it("keeps only NVIDIA FLUX image models selected", async () => {
    const store = await DesktopStore.create(userDataPath);

    const publicState = await store.updateProviders({
      ...defaultProviderSettings,
      activeProvider: "nvidia",
      openai: {
        ...defaultProviderSettings.openai,
        imageModel: "gpt-image-2"
      },
      nvidia: {
        ...defaultProviderSettings.nvidia,
        imageModel: "black-forest-labs/flux_1-schnell"
      }
    });

    expect(publicState.providers.activeProvider).toBe("nvidia");
    expect(publicState.providers.nvidia.imageModel).toBe("black-forest-labs/flux_1-schnell");
    expect(publicState.providers.openai.imageModel).toBe("");
  });

  it("starts without the old welcome chat and can delete chats", async () => {
    const store = await DesktopStore.create(userDataPath);
    let publicState = await store.getPublicState();

    expect(publicState.activeChatId).toBeNull();
    expect(publicState.hasSeenStarterCard).toBe(false);
    expect(publicState.chats).toEqual([]);

    publicState = await store.createChat();
    const chatId = publicState.activeChatId!;
    expect(publicState.chats).toHaveLength(1);
    expect(publicState.hasSeenStarterCard).toBe(true);

    publicState = await store.deleteChat(chatId);
    expect(publicState.activeChatId).toBeNull();
    expect(publicState.hasSeenStarterCard).toBe(true);
    expect(publicState.chats).toEqual([]);
  });

  it("marks the starter card as seen without creating a chat", async () => {
    const store = await DesktopStore.create(userDataPath);

    let publicState = await store.markStarterCardSeen();
    expect(publicState.hasSeenStarterCard).toBe(true);

    const reloadedStore = await DesktopStore.create(userDataPath);
    publicState = await reloadedStore.getPublicState();
    expect(publicState.hasSeenStarterCard).toBe(true);
  });
});

describe("chat title summaries", () => {
  it("summarizes Discord bot test requests into a short useful title", () => {
    expect(createChatTitleFromContent("can you create a python file then test it for a discord bot whatever you want")).toBe(
      "Discord bot and testing"
    );
  });

  it("uses intent-based titles for greetings, websites, and YouTube searches", () => {
    expect(createChatTitleFromContent("hi")).toBe("User greeting");
    expect(createChatTitleFromContent("search who Donald Trump is and make a website based off him")).toBe("Donald Trump website");
    expect(createChatTitleFromContent("find Parker get a job's YouTube live streams about homosexuality")).toBe(
      "Parker YouTube streams"
    );
  });
});
