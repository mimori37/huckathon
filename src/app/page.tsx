"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Hash, MessageSquare, Send, User, LogOut, Plus, Search, Bell, Smile, Reply } from "lucide-react";

type Profile = {
  id: string;
  username: string;
  color: string;
};

type Channel = {
  id: string;
  name: string;
  description: string;
};

type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji_code: string;
};

type Message = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
  profiles: {
    username: string;
    color: string;
  };
  reactions: Reaction[];
};

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "🙌", "🔥"];

export default function Home() {
  const [username, setUsername] = useState("");
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Auth
  useEffect(() => {
    const savedUser = localStorage.getItem("chat_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Fetch Channels
  useEffect(() => {
    if (!user) return;
    const fetchChannels = async () => {
      const { data } = await supabase.from("channels").select("*").order("name");
      if (data) {
        setChannels(data);
        setActiveChannel(data.find(c => c.name === "general") || data[0]);
      }
    };
    fetchChannels();
  }, [user]);

  // Fetch Messages and Subscribe
  useEffect(() => {
    if (!activeChannel || !user) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select(`
          *,
          profiles (username, color),
          reactions (*)
        `)
        .eq("channel_id", activeChannel.id)
        .order("created_at", { ascending: true });

      if (data) setMessages(data as any);
    };

    fetchMessages();

    // Subscribe to new messages
    const messageSub = supabase
      .channel(`room:${activeChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeChannel.id}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, color")
            .eq("id", payload.new.user_id)
            .single();

          const fullMessage: Message = {
            ...(payload.new as any),
            profiles: profile || { username: "unknown", color: "text-slate-500" },
            reactions: []
          };

          setMessages((prev) => [...prev, fullMessage]);
        }
      )
      .subscribe();

    // Subscribe to reaction changes
    const reactionSub = supabase
      .channel(`reactions:${activeChannel.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages(prev => prev.map(m => {
              if (m.id !== payload.new.message_id) return m;

              const exists = m.reactions?.some(r => r.id === payload.new.id);
              if (exists) return m;

              return { ...m, reactions: [...(m.reactions || []), payload.new as Reaction] };
            }));
          } else if (payload.eventType === "DELETE") {
            // In DELETE events, payload.old only contains the PRIMARY KEY (id) by default
            // So we must scan all messages to find and remove the reaction with that id
            setMessages(prev => prev.map(m => ({
              ...m,
              reactions: (m.reactions || []).filter(r => r.id !== payload.old.id)
            })));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSub);
      supabase.removeChannel(reactionSub);
    };
  }, [activeChannel, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (existing) {
        setUser(existing);
        localStorage.setItem("chat_user", JSON.stringify(existing));
      } else {
        const id = crypto.randomUUID();
        const colors = ["text-indigo-600", "text-rose-600", "text-emerald-600", "text-amber-600", "text-violet-600"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const { data: newUser, error } = await supabase
          .from("profiles")
          .insert([{ id, username, color: randomColor }])
          .select()
          .single();

        if (error) throw error;
        setUser(newUser);
        localStorage.setItem("chat_user", JSON.stringify(newUser));
      }
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("chat_user");
    setUser(null);
    setUsername("");
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !user) return;

    const content = newMessage;
    setNewMessage("");

    const { error } = await supabase.from("messages").insert([
      {
        channel_id: activeChannel.id,
        user_id: user.id,
        content: content,
      },
    ]);

    if (error) {
      console.error(error);
      alert("送信に失敗しました。");
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    const existingReaction = messages
      .find(m => m.id === messageId)
      ?.reactions?.find(r => r.user_id === user.id && r.emoji_code === emoji);

    if (existingReaction) {
      await supabase.from("reactions").delete().eq("id", existingReaction.id);
    } else {
      await supabase.from("reactions").insert([
        {
          message_id: messageId,
          user_id: user.id,
          emoji_code: emoji,
        }
      ]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 px-4">
        <div className="w-full max-w-md p-10 rounded-3xl bg-white border border-slate-200 soft-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500"></div>
          <div className="flex justify-center mb-10">
            <div className="p-4 bg-indigo-50 rounded-2xl">
              <MessageSquare className="w-10 h-10 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 text-center mb-2 tracking-tight">Huckathon</h1>
          <p className="text-slate-500 text-center mb-10 text-sm font-medium">参加するにはユーザー名を入力してください</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Your Identity</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="kenshiro"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-semibold placeholder:text-slate-300 text-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/10 mt-2 text-sm uppercase tracking-widest"
            >
              Start Chatting
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100">
      {/* Sidebar */}
      <div className="w-72 bg-slate-50 border-r border-slate-100 flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/10 ring-4 ring-white">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">Huckathon</span>
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <Bell className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              type="text"
              placeholder="Jump to..."
              className="w-full bg-slate-200/50 border-none rounded-xl py-2 pl-9 pr-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center justify-between">
            <span>Channels</span>
            <Plus className="w-4 h-4 cursor-pointer hover:text-indigo-600 transition-colors" />
          </div>
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${activeChannel?.id === channel.id
                ? "bg-white text-indigo-600 soft-shadow ring-1 ring-slate-100"
                : "text-slate-500 hover:bg-white hover:text-slate-800"
                }`}
            >
              <Hash className={`w-4 h-4 ${activeChannel?.id === channel.id ? "text-indigo-500" : "text-slate-300 transition-colors group-hover:text-slate-400"}`} />
              <span className="font-bold text-[14px]">{channel.name}</span>
              {activeChannel?.id === channel.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              )}
            </button>
          ))}
        </div>

        {/* User Profile info */}
        <div className="p-4 m-4 bg-white rounded-2xl border border-slate-100 soft-shadow">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner ${user.color}`}>
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate leading-tight text-slate-900">{user.username}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Online</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-20 border-b border-slate-100 flex items-center px-10 justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10 font-bold">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-indigo-500" />
                <span className="font-bold text-lg tracking-tight text-slate-900">{activeChannel?.name || "Select Channel"}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium ml-7">{activeChannel?.description}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <div className="flex -space-x-2 mr-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-7 h-7 rounded-lg bg-slate-100 border-2 border-white flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-10 space-y-8 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="p-6 bg-slate-50 rounded-full">
                <MessageSquare className="w-10 h-10 text-slate-200" />
              </div>
              <div className="text-center">
                <p className="text-slate-900 font-bold">まだメッセージはありません</p>
                <p className="text-slate-400 text-sm italic mt-1">最初のひとことを送ってみましょう！</p>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isFirstInBatch = index === 0 || messages[index - 1].user_id !== msg.user_id;

              // Group reactions by emoji
              const groupedReactions = (msg.reactions || []).reduce((acc, r) => {
                acc[r.emoji_code] = (acc[r.emoji_code] || []);
                acc[r.emoji_code].push(r);
                return acc;
              }, {} as Record<string, Reaction[]>);

              return (
                <div key={msg.id} className={`flex gap-4 group transition-all duration-300 relative ${isFirstInBatch ? 'mt-6' : 'mt-1 pl-14'}`}>
                  {isFirstInBatch && (
                    <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 border border-slate-100 shadow-sm ${msg.profiles.color}`}>
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <div className="space-y-1 group flex-1">
                    {isFirstInBatch && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[15px] text-slate-900 leading-none">{msg.profiles.username}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                    <div className="relative group">
                      <p className="text-slate-700 leading-relaxed text-[15px] max-w-4xl py-1">
                        {msg.content}
                      </p>

                      {/* Floating actions */}
                      <div className={`absolute -top-6 right-0 flex items-center gap-1 bg-white border border-slate-100 rounded-lg p-1 soft-shadow opacity-0 group-hover:opacity-100 transition-all z-10 translate-y-2 group-hover:translate-y-0`}>
                        {COMMON_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="p-1.5 hover:bg-slate-50 rounded text-sm transition-transform active:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                        <div className="w-px h-4 bg-slate-100 mx-1"></div>
                        <button className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-indigo-600">
                          <Reply className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-indigo-600">
                          <Smile className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Rendered reactions */}
                    {Object.keys(groupedReactions).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(groupedReactions).map(([emoji, reacts]) => {
                          const hasReacted = reacts.some(r => r.user_id === user.id);
                          return (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border transition-all ${hasReacted
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                                : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                }`}
                            >
                              <span>{emoji}</span>
                              <span className={hasReacted ? "text-indigo-400" : "text-slate-300"}>{reacts.length}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="px-10 pb-8 pt-2">
          <form onSubmit={sendMessage} className="relative group max-w-4xl mx-auto shadow-sm">
            <div className="absolute -inset-2 bg-indigo-500/5 rounded-[2rem] scale-95 opacity-0 group-focus-within:scale-100 group-focus-within:opacity-100 transition-all duration-500"></div>
            <div className="relative flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-3 transition-colors group-focus-within:bg-white group-focus-within:border-indigo-200">
              <div className="p-2 mb-1.5 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer text-slate-400">
                <Plus className="w-5 h-5" />
              </div>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e as any);
                  }
                }}
                rows={1}
                placeholder={`${activeChannel ? '#' + activeChannel.name : 'Channel'} へのメッセージ`}
                className="flex-1 bg-transparent border-none py-3 text-slate-900 focus:outline-none focus:ring-0 font-medium placeholder:text-slate-400 text-sm resize-none scrollbar-hide max-h-32"
              />
              <button
                type="submit"
                className="mb-1 p-3 bg-indigo-600 rounded-xl text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/10 active:scale-90 disabled:opacity-20 disabled:grayscale"
                disabled={!newMessage.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          <div className="flex justify-center gap-6 mt-4 opacity-40">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              Enter to Send
            </p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              Shift + Enter for New Line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
