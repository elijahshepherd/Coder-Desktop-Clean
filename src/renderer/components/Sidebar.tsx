import { MessageSquareText, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Trash2, Grid3X3 } from "lucide-react";
import type { ChatThread } from "../../shared/types";
import { CoderMark } from "./CoderMark";

interface SidebarProps {
  activeChatId: string;
  chats: ChatThread[];
  isCollapsed: boolean;
  pendingChatIds: ReadonlySet<string>;
  search: string;
  onCreateChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onResizeStart: () => void;
  onSearchChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onOpenSettings: () => void;
  onToggleCollapse: () => void;
}

export function Sidebar({
  activeChatId,
  chats,
  isCollapsed,
  pendingChatIds,
  search,
  onCreateChat,
  onDeleteChat,
  onResizeStart,
  onSearchChange,
  onSelectChat,
  onOpenSettings,
  onToggleCollapse
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <CoderMark size={34} />
          </div>
          <h1>Coder Desktop</h1>
        </div>
        <button
          className="icon-button sidebar-collapse-button"
          type="button"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapse}
        >
          {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        <button className="nav-row" type="button" aria-label="New chat" title="New chat" onClick={onCreateChat}>
          <Plus size={15} />
          <span>New chat</span>
        </button>
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label="Search chats"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search chats"
          />
        </div>
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-title">
          <span>Chats</span>
        </div>
        <div className="chat-list" aria-label="Chats">
          {chats.map((chat) => {
            const isPending = pendingChatIds.has(chat.id);

            return (
              <div
                className={`chat-item-shell${chat.id === activeChatId ? " active" : ""}${isPending ? " loading" : ""}`}
                key={chat.id}
              >
                <button className="chat-item" type="button" title={chat.title} onClick={() => onSelectChat(chat.id)}>
                  <MessageSquareText size={13} />
                  <span>{chat.title}</span>
                  {isPending ? <span className="chat-loading-dot" aria-label="Working" /> : null}
                </button>
                <button className="chat-delete-button" type="button" aria-label={`Delete ${chat.title}`} onClick={() => onDeleteChat(chat.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-separator" aria-hidden="true" />
        <button className="footer-row" type="button" aria-label="Sub Apps" title="Sub Apps" onClick={() => window.dispatchEvent(new CustomEvent("sub-apps:open"))}>
          <Grid3X3 size={15} />
          <span>Sub Apps</span>
        </button>
        <button className="footer-row" type="button" aria-label="Open settings" title="Open settings" onClick={onOpenSettings}>
          <Settings size={15} />
          <span>Settings</span>
        </button>
      </div>
      <div className="sidebar-resize-handle" aria-hidden="true" onPointerDown={onResizeStart} />
    </aside>
  );
}
