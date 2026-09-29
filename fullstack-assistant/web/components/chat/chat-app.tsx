"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PanelLeftIcon, SquarePenIcon } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/chat/app-sidebar";
import { Composer } from "@/components/chat/composer";
import { EmptyState, SuggestionGrid } from "@/components/chat/empty-state";
import { Markdown } from "@/components/chat/markdown";
import { MessageList } from "@/components/chat/message-list";
import { ModelPicker } from "@/components/chat/model-picker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VoiceLoading, VoiceTimer } from "@/components/voice/voice-chrome";
import { useChat } from "@/hooks/use-chat";
import { useModels } from "@/hooks/use-models";
import { useVoiceConfig } from "@/hooks/use-voice-config";
import { APP_CONFIG } from "@/lib/config";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

// LiveKit is only downloaded when someone starts voice mode.
const VoiceSession = dynamic(() => import("@/components/voice/voice-session"), {
  ssr: false,
  loading: () => <VoiceLoading />,
});

const renderMarkdown = (text: string) => <Markdown content={text} />;

interface ActiveVoice {
  key: number;
  startedAt: number;
  history: ChatMessage[];
}

export function ChatApp() {
  const models = useModels();
  const chat = useChat(models.selection);
  const voiceSetup = useVoiceConfig();
  const [sidebarOpen, setSidebarOpen] = useState(true); // desktop
  const [mobileOpen, setMobileOpen] = useState(false); // mobile sheet
  const [voice, setVoice] = useState<ActiveVoice | null>(null);

  const empty = !chat.active || chat.active.messages.length === 0;
  const noModels = !models.loading && !models.effective;
  const voiceEnabled = !!voiceSetup.config?.enabled && !noModels;

  // ---- voice mode ----
  // Transcripts go into the chat that was open when voice started, or into a
  // new chat created on the first thing the user says.
  const voiceConversation = useRef<string | null>(null);
  const voiceBuffer = useRef<ChatMessage[]>([]);
  const appendVoice = chat.appendVoiceMessages;

  const startVoice = useCallback(() => {
    if (chat.streaming) chat.stop();
    const current = chat.active && chat.active.messages.length ? chat.active : null;
    voiceConversation.current = current?.id ?? null;
    voiceBuffer.current = [];
    setVoice({ key: Date.now(), startedAt: Date.now(), history: current?.messages ?? [] });
    setMobileOpen(false);
  }, [chat]);

  const endVoice = useCallback(() => setVoice(null), []);
  const retryVoice = useCallback(
    () => setVoice((v) => (v ? { ...v, key: v.key + 1, startedAt: Date.now() } : v)),
    [],
  );

  const saveTranscripts = useCallback(
    (batch: ChatMessage[]) => {
      // Merge by id: a later batch may carry updated text for a buffered message.
      const merged = new Map(voiceBuffer.current.map((m) => [m.id, m]));
      for (const m of batch) merged.set(m.id, m);
      const all = [...merged.values()];
      // Don't create a chat for a greeting nobody answered.
      if (!voiceConversation.current && !all.some((m) => m.role === "user")) {
        voiceBuffer.current = all;
        return;
      }
      voiceBuffer.current = [];
      voiceConversation.current = appendVoice(voiceConversation.current, all);
    },
    [appendVoice],
  );

  // ---- navigation (ends voice mode first) ----
  const newChat = useCallback(() => {
    setVoice(null);
    chat.newChat();
    setMobileOpen(false);
  }, [chat]);

  const openChat = (id: string) => {
    if (voice && id !== voiceConversation.current) setVoice(null);
    chat.openChat(id);
    setMobileOpen(false);
  };

  const deleteChat = (id: string) => {
    if (voice && id === voiceConversation.current) setVoice(null);
    const undo = chat.deleteChat(id);
    toast("Chat deleted", { action: { label: "Undo", onClick: undo } });
  };

  const clearAll = () => {
    setVoice(null);
    const undo = chat.clearAll();
    toast("All chats deleted", { action: { label: "Undo", onClick: undo } });
  };

  // Global shortcuts: new chat, search, stop. (Voice mode handles its own Esc.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarOpen(true);
        setMobileOpen(true);
        requestAnimationFrame(() => document.getElementById("chat-search")?.focus());
      } else if (e.key === "Escape" && chat.streaming) {
        chat.stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat, newChat]);

  const sidebarProps = {
    conversations: chat.conversations,
    activeId: chat.activeId,
    onNewChat: newChat,
    onOpen: openChat,
    onDelete: deleteChat,
    onClearAll: clearAll,
    apiOnline: !models.error,
  };

  const composer = (
    <Composer
      onSend={chat.send}
      onStop={chat.stop}
      onVoice={voiceEnabled ? startVoice : undefined}
      streaming={chat.streaming}
      disabled={noModels}
      autoFocus
      placeholder={noModels ? "No AI model available — see the model menu" : undefined}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r transition-[margin] duration-200 md:block md:w-72",
          !sidebarOpen && "md:-ml-72",
        )}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <AppSidebar {...sidebarProps} onCollapse={() => setSidebarOpen(false)} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showClose={false} className="w-72 p-0 md:hidden">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <SheetDescription className="sr-only">Your chat history</SheetDescription>
          <AppSidebar {...sidebarProps} onCollapse={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open sidebar"
                className={cn(sidebarOpen && "md:hidden")}
                onClick={() => {
                  setSidebarOpen(true);
                  setMobileOpen(true);
                }}
              >
                <PanelLeftIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open sidebar</TooltipContent>
          </Tooltip>
          <ModelPicker models={models} />
          <div className="flex-1" />
          {voice && <VoiceTimer startedAt={voice.startedAt} />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="New chat"
                className={cn(sidebarOpen && "md:hidden")}
                onClick={newChat}
              >
                <SquarePenIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
        </header>

        {voice ? (
          <VoiceSession
            key={voice.key}
            selection={models.selection}
            participantName={APP_CONFIG.user.name}
            history={voice.history}
            voices={voiceSetup.config?.voices ?? []}
            voice={voiceSetup.prefs.voice}
            captions={voiceSetup.prefs.captions}
            onPrefsChange={voiceSetup.setPrefs}
            onTranscripts={saveTranscripts}
            onEnd={endVoice}
            onRetry={retryVoice}
            renderText={renderMarkdown}
          />
        ) : empty ? (
          <div className="flex flex-1 flex-col justify-center overflow-y-auto px-3 pb-[8vh] sm:px-6">
            <EmptyState />
            {composer}
            <SuggestionGrid onPick={chat.send} />
          </div>
        ) : (
          <>
            <MessageList
              conversation={chat.active!}
              streaming={chat.streaming}
              onRegenerate={chat.regenerate}
              onFeedback={chat.setFeedback}
            />
            <div className="shrink-0 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
              {composer}
            </div>
          </>
        )}
        <p className="shrink-0 pb-2 text-center text-xs text-muted-foreground">
          AI can make mistakes. Check important information.
        </p>
      </main>
    </div>
  );
}
