import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { submitEnquiry } from "@/lib/enquiries.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bot,
  User,
  Send,
  Loader2,
  RefreshCw,
  UserPlus,
  ClipboardCheck,
  ShieldCheck,
  ArrowRightCircle,
} from "lucide-react";
import { CategoryBadge, PriorityBadge } from "@/components/enquiry-badges";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "bot" | "user" | "system_note";

interface Message {
  id: number;
  role: Role;
  text: string;
  typing?: boolean;
  metadata?: {
    category?: string | null;
    priority?: string | null;
    recommended_action?: string | null;
    assigned_staff?: string | null;
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

let msgId = 0;
const mkMsg = (role: Role, text: string, typing = false, metadata?: Message["metadata"]): Message => ({
  id: ++msgId,
  role,
  text,
  typing,
  metadata,
});

export function NewClientChatbot() {
  const submit = useServerFn(submitEnquiry);
  const qc = useQueryClient();

  // State: "form" | "chat"
  const [mode, setMode] = useState<"form" | "chat">("form");

  // Form State
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    property_address: "",
  });

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mode]);

  // Focus input when entering chat
  useEffect(() => {
    if (mode === "chat") {
      inputRef.current?.focus();
    }
  }, [mode]);

  const mutation = useMutation({
    mutationFn: (updatedMessages: Message[]) =>
      submit({
        data: {
          ...formData,
          client_phone: formData.client_phone || null,
          property_address: formData.property_address || null,
          enquiry_type: "new_client",
          messages: updatedMessages.map(m => ({ role: m.role, text: m.text })),
        },
      }),
    onSuccess: (res) => {
      const row = res.enquiry;
      
      // 1. Add the main AI response as a bot message
      addBotMsg(row.suggested_response || "I've received your message and notified the team.");

      // 2. Add the staff recommendation/internal note if it's a complaint or maintenance
      // We only show this if the AI identifies an escalation need
      if (row.recommended_action || row.assigned_staff) {
        setTimeout(() => {
          setMessages(prev => [...prev, mkMsg("system_note", "Staff Recommendation", false, {
            category: row.category,
            priority: row.priority,
            recommended_action: row.recommended_action,
            assigned_staff: row.assigned_staff
          })]);
        }, 1200);
      }

      qc.invalidateQueries({ queryKey: ["enquiries"] });
    },
    onError: (err: Error) => {
      addBotMsg(`⚠️ I encountered an issue: ${err.message}. Please try again.`);
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function addBotMsg(text: string) {
    const typingMsg = mkMsg("bot", "...", true);
    setMessages((prev) => [...prev, typingMsg]);
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === typingMsg.id ? { ...m, text, typing: false } : m))
      );
    }, 800);
  }

  function addUserMsg(text: string): Message[] {
    const newMsg = mkMsg("user", text);
    const newHistory = [...messages, newMsg];
    setMessages(newHistory);
    return newHistory;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.client_name || !formData.client_email) {
      toast.error("Please provide your name and email.");
      return;
    }

    setMode("chat");
    setMessages([
      mkMsg("bot", `👋 Hello **${formData.client_name}**! Welcome to Strata Management Consultants.`),
      mkMsg("bot", "I can help you with questions about our **Community Cafe**, operating hours, or any property issues. **How can I help you today?**"),
    ]);
  }

  function handleSend() {
    const msg = input.trim();
    if (!msg || mutation.isPending) return;
    setInput("");

    const updatedHistory = addUserMsg(msg);
    mutation.mutate(updatedHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleReset() {
    setMode("form");
    setFormData({
      client_name: "",
      client_email: "",
      client_phone: "",
      property_address: "",
    });
    setMessages([]);
    setInput("");
  }

  // ── Render Form ──────────────────────────────────────────────────────────────

  if (mode === "form") {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="client_name">Full Name</Label>
            <Input
              id="client_name"
              required
              placeholder="Jane Smith"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client_email">Email Address</Label>
            <Input
              id="client_email"
              type="email"
              required
              placeholder="jane@example.com"
              value={formData.client_email}
              onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="client_phone">Phone (Optional)</Label>
              <Input
                id="client_phone"
                placeholder="+61 ..."
                value={formData.client_phone}
                onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="property_address">Property/Scheme</Label>
              <Input
                id="property_address"
                placeholder="12 Harbour St"
                value={formData.property_address}
                onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
              />
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full bg-gradient-to-r from-primary to-[var(--primary-glow)] text-primary-foreground shadow-[var(--shadow-elegant)]" size="lg">
          <UserPlus className="mr-2 h-4 w-4" />
          Start Conversation
        </Button>
      </form>
    );
  }

  // ── Render Chat ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-500">
      {/* Message Thread */}
      <div
        className="flex flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin"
        style={{ minHeight: 320, maxHeight: 480 }}
        aria-live="polite"
      >
        {messages.map((msg) => (
          <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {msg.role === "system_note" ? (
              <SystemNote metadata={msg.metadata} />
            ) : (
              <div className={`flex items-end gap-2 ${msg.role === "bot" ? "justify-start" : "justify-end"}`}>
                {msg.role === "bot" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--primary-glow)] text-primary-foreground shadow-sm">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  msg.role === "bot" 
                    ? "rounded-bl-sm bg-muted text-foreground" 
                    : "rounded-br-sm bg-gradient-to-r from-primary to-[var(--primary-glow)] text-primary-foreground"
                }`}>
                  {msg.typing ? <TypingDots /> : <FormattedText text={msg.text} />}
                </div>
              </div>
            )}
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex items-end gap-2 justify-start animate-pulse">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl px-3.5 py-2.5 bg-muted text-foreground rounded-bl-sm">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area (Always Visible for Continuous Chat) */}
      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1"
            disabled={mutation.isPending}
            autoComplete="off"
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || mutation.isPending} 
            size="icon" 
            className="shrink-0 bg-primary shadow-sm"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <button 
          onClick={handleReset}
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors text-center mt-1 uppercase tracking-widest font-medium"
        >
          Reset Session
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SystemNote({ metadata }: { metadata?: Message["metadata"] }) {
  if (!metadata) return null;
  return (
    <div className="my-2 rounded-xl border-2 border-dashed bg-muted/30 p-4 animate-in zoom-in-95 duration-500">
      <div className="mb-3 flex items-center gap-2 text-primary">
        <ShieldCheck className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider">Internal Triage Recommendation</span>
      </div>
      
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={metadata.category} />
          <PriorityBadge priority={metadata.priority} />
        </div>

        {metadata.assigned_staff && (
          <div className="flex items-start gap-2.5">
            <UserPlus className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Target Staff Role</p>
              <p className="text-xs font-semibold">{metadata.assigned_staff}</p>
            </div>
          </div>
        )}

        {metadata.recommended_action && (
          <div className="flex items-start gap-2.5">
            <ClipboardCheck className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Recommended Action</p>
              <p className="text-xs leading-relaxed">{metadata.recommended_action}</p>
            </div>
          </div>
        )}

        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground italic">
          <ArrowRightCircle className="h-3 w-3" />
          <span>Note: This is an AI-generated recommendation for staff.</span>
        </div>
      </div>
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i} className="whitespace-pre-line">{part}</span>
        )
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}
