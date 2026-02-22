"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Hash, MessageSquare, Send, User } from "lucide-react";

type Profile = {
  id: string;
  username: string;
  color: string;
};

export default function Home() {
  const [username, setUsername] = useState("");
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("chat_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    try {
      // Check if username already exists
      const { data: existing, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (existing) {
        // Log in as existing user
        setUser(existing);
        localStorage.setItem("chat_user", JSON.stringify(existing));
      } else {
        // Create new user
        const id = crypto.randomUUID();
        const colors = ["text-blue-500", "text-red-500", "text-green-500", "text-purple-500", "text-orange-500"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const { data: newUser, error: insertError } = await supabase
          .from("profiles")
          .insert([{ id, username, color: randomColor }])
          .select()
          .single();

        if (insertError) throw insertError;
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

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 px-4">
        <div className="w-full max-w-md p-8 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Huckathon Chat</h1>
          <p className="text-zinc-500 text-center mb-8 text-sm font-medium">ユーザー名を入力して開始しましょう</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 px-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例: kenshiro"
                className="w-full px-4 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium placeholder:text-zinc-700"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold rounded-xl transition-all shadow-xl shadow-indigo-600/20 mt-2"
            >
              ログインして参加
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <div className="w-72 bg-zinc-950 border-r border-zinc-900 flex flex-col">
        <div className="p-5 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight">Huckathon</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-4 py-3 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Channels</div>
          {["general", "random", "huckathon-dev"].map((channel) => (
            <button
              key={channel}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${channel === "general" ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
                }`}
            >
              <Hash className={`w-4 h-4 ${channel === "general" ? "text-indigo-400" : "text-zinc-700"}`} />
              <span className="font-bold text-sm tracking-tight">{channel}</span>
            </button>
          ))}
        </div>

        <div className="p-4 bg-zinc-950 border-t border-zinc-900">
          <div className="bg-zinc-900/50 p-3 rounded-2xl flex items-center gap-3 border border-zinc-900">
            <div className={`w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 shadow-inner ${user.color}`}>
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black truncate leading-tight text-white">{user.username}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-zinc-900/20">
        {/* Header */}
        <div className="h-[72px] border-b border-zinc-900 flex items-center px-8 justify-between bg-zinc-950/40 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800">
              <Hash className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-white leading-none block">general</span>
              <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider mt-0.5 block opacity-60">Everything start here</span>
            </div>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          <div className="flex gap-5 group animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="w-11 h-11 rounded-2xl bg-zinc-950 flex items-center justify-center flex-shrink-0 text-indigo-500 border border-zinc-800 shadow-xl overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="font-black text-white text-sm tracking-tight bg-zinc-800 px-2.5 py-0.5 rounded-lg border border-zinc-700">SYSTEM</span>
                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.1em]">12:00 PM</span>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl rounded-tl-none items-start shadow-sm max-w-2xl">
                <p className="text-zinc-300 leading-relaxed text-[15px] font-medium">
                  ようこそ！ここではチャンネルを切り替えたり、メッセージを送ったり、リアクションを付けたりできます。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Message Input */}
        <div className="p-8 pt-0">
          <div className="relative group max-w-5xl mx-auto">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500"></div>
            <input
              type="text"
              placeholder="#general へのメッセージ"
              className="relative w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600/50 transition-all font-medium pr-16 shadow-2xl placeholder:text-zinc-700 text-[15px]"
            />
            <button className="absolute right-3.5 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 rounded-xl text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30 active:scale-95">
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] mt-4 opacity-40">
            Press Enter to Send · Shift + Enter for New Line
          </p>
        </div>
      </div>
    </div>
  );
}
