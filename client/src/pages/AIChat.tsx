import { useState, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Plus, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AIChat() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Queries
  const conversationsQuery = trpc.ai.getConversations.useQuery();
  const messagesQuery = trpc.ai.getMessages.useQuery(
    { conversationId: selectedConversationId! },
    { enabled: !!selectedConversationId }
  );

  // Mutations
  const createConversation = trpc.ai.createConversation.useMutation({
    onSuccess: (data) => {
      setSelectedConversationId(data.id);
      utils.ai.getConversations.invalidate();
      toast.success("שיחה חדשה נוצרה");
    },
  });

  const sendMessage = trpc.ai.sendMessage.useMutation({
    onSuccess: () => {
      utils.ai.getMessages.invalidate({ conversationId: selectedConversationId! });
      setMessage("");
      setIsSending(false);
    },
    onError: (error) => {
      toast.error("שגיאה בשליחת הודעה: " + error.message);
      setIsSending(false);
    },
  });

  const deleteConversation = trpc.ai.deleteConversation.useMutation({
    onSuccess: () => {
      utils.ai.getConversations.invalidate();
      setSelectedConversationId(null);
      toast.success("שיחה נמחקה");
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  // Select first conversation on load
  useEffect(() => {
    if (conversationsQuery.data && conversationsQuery.data.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversationsQuery.data[0].id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversationId || isSending) return;

    setIsSending(true);
    sendMessage.mutate({
      conversationId: selectedConversationId,
      message: message.trim(),
    });
  };

  const handleNewConversation = () => {
    createConversation.mutate({ title: "שיחה חדשה" });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar - Conversations List */}
      <div className="w-64 flex flex-col gap-2">
        <Button onClick={handleNewConversation} className="w-full" disabled={createConversation.isPending}>
          <Plus className="w-4 h-4 mr-2" />
          שיחה חדשה
        </Button>

        <Card className="flex-1 p-4">
          <h3 className="font-semibold mb-4 text-sm text-muted-foreground">שיחות קודמות</h3>
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-2">
              {conversationsQuery.data?.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                    selectedConversationId === conv.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setSelectedConversationId(conv.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate">
                        {conv.title || `שיחה ${conv.id}`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation.mutate({ conversationId: conv.id });
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(conv.updatedAt).toLocaleDateString("he-IL")}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">עוזר AI לניהול תמחור</h2>
              <p className="text-sm text-muted-foreground">
                שאל שאלות על מחירים, מתחרים, וקבל המלצות תמחור
              </p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          {selectedConversationId ? (
            <div className="space-y-4 pb-4">
              {messagesQuery.data?.length === 0 ? (
                <div className="text-center text-muted-foreground mt-12">
                  <Bot className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <h3 className="text-lg font-semibold mb-2">התחל שיחה</h3>
                  <p className="text-sm">שאל שאלות כמו:</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>"מה המחיר הממוצע של המתחרים שלי?"</li>
                    <li>"תן לי השוואה בין המחירים ב-7 הימים הקרובים"</li>
                    <li>"מי המתחרה הכי זול באזור?"</li>
                  </ul>
                </div>
              ) : (
                messagesQuery.data?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString("he-IL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-foreground text-xs font-semibold">אתה</span>
                      </div>
                    )}
                  </div>
                ))
              )}
              {isSending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>בחר שיחה או צור שיחה חדשה</p>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        {selectedConversationId && (
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                placeholder="כתוב הודעה..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                className="flex-1"
                dir="rtl"
              />
              <Button onClick={handleSendMessage} disabled={!message.trim() || isSending}>
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              לחץ Enter לשליחה • Shift+Enter לשורה חדשה
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
