"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Hash, MessageSquare, Send, User, LogOut } from "lucide-react";

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
};

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
          profiles (username, color)
        `)
        .eq("channel_id", activeChannel.id)
        .order("created_at", { ascending: true });

      if (data) setMessages(data as any);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
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
          // Fetch the profile for the new message to get the join
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, color")
            .eq("id", payload.new.user_id)
            .single();

          const fullMessage: Message = {
            ...(payload.new as any),
            profiles: profile || { username: "unknown", color: "text-zinc-500" }
          };

          setMessages((prev) => [...prev, fullMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel, user]);

  // Scroll to bottom
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
        const colors = ["text-blue-500", "text-rose-500", "text-emerald-500", "text-amber-500", "text-violet-500"];
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

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-zinc-950 text-white font-black italic tracking-widest animate-pulse">LOADING...</div>;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 px-4">
        <div className="w-full max-w-md p-10 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <MessageSquare className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white text-center mb-2 tracking-tight">Huckathon Chat</h1>
          <p className="text-zinc-500 text-center mb-10 text-sm font-medium">参加するにはユーザー名を入力してください</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-3 px-1">Identity</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="kenshiro"
                className="w-full px-5 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-bold placeholder:text-zinc-800 text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97] text-white font-black rounded-2xl transition-all shadow-2xl shadow-indigo-600/20 mt-4 text-sm uppercase tracking-widest"
            >
              Enter Workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <div className="w-80 bg-zinc-950 border-r border-zinc-900 flex flex-col">
        <div className="p-6 flex items-center justify-between border-b border-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-2xl tracking-tighter uppercase italic">HUCK</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 mt-2">
          <div className="px-4 py-3 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center justify-between">
            <span>Channels</span>
            <span className="bg-zinc-900 w-5 h-5 rounded flex items-center justify-center text-zinc-700">{channels.length}</span>
          </div>
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${activeChannel?.id === channel.id
                  ? "bg-zinc-900 text-white shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)] border border-zinc-800"
                  : "text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300"
                }`}
            >
              <Hash className={`w-4 h-4 transition-colors ${activeChannel?.id === channel.id ? "text-indigo-400" : "text-zinc-800 group-hover:text-zinc-600"}`} />
              <span className="font-black text-[15px] tracking-tight">{channel.name}</span>
            </button>
          ))}
        </div>

        <div className="p-6 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-900">
          <div className="bg-zinc-900/40 p-3.5 rounded-[2rem] flex items-center gap-4 border border-zinc-900/50 group relative">
            <div className={`w-12 h-12 rounded-2xl bg-zinc-950 flex items-center justify-center border border-zinc-800 shadow-inner overflow-hidden ${user.color}`}>
              <User className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-black truncate leading-tight text-white tracking-tight">{user.username}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse"></div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black">Securely Linked</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 text-zinc-700 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="h-[88px] border-b border-zinc-900/50 flex items-center px-10 justify-between bg-zinc-950/60 backdrop-blur-3xl sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
              <Hash className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-white leading-none block uppercase italic">{activeChannel?.name || "Select Channel"}</span>
              <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-[0.2em] mt-1.5 block opacity-50">{activeChannel?.description}</span>
            </div>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-10 space-y-10 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-800 space-y-4">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.3em] opacity-30">No transmissions yet</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-6 group animate-in fade-in slide-in-from-bottom-3 duration-700">
                <div className={`w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center flex-shrink-0 border border-zinc-800 shadow-2xl transition-transform group-hover:scale-110 ${msg.profiles.color}`}>
                  <User className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <span className="font-black text-white text-base tracking-tighter uppercase">{msg.profiles.username}</span>
                    <span className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.1em]">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="bg-zinc-900/30 border border-zinc-800/80 p-5 rounded-3xl rounded-tl-none shadow-sm max-w-3xl group-hover:border-zinc-700 transition-colors">
                    <p className="text-zinc-300 leading-relaxed text-[16px] font-medium selection:bg-indigo-500/50">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-10 pt-0">
          <form onSubmit={sendMessage} className="relative group max-w-5xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-20 transition duration-1000"></div>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`${activeChannel ? '#' + activeChannel.name : 'Channel'} へのメッセージ`}
              className="relative w-full bg-zinc-950 border border-zinc-800/60 rounded-[1.8rem] px-8 py-6 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/30 transition-all font-bold pr-20 shadow-2xl placeholder:text-zinc-800 text-lg border-b-zinc-800/20"
            />
            <button
              type="submit"
              className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-indigo-600 rounded-2xl text-white hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/40 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!newMessage.trim()}
            >
              <Send className="w-6 h-6" />
            </button>
          </form>
          <div className="flex justify-center gap-8 mt-6">
            <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.3em] opacity-50">
              Return to Send
            </p>
            <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.3em] opacity-50">
              Shift + Return for linebreak
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
