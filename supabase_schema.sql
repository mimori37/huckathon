-- Profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channels table
CREATE TABLE public.channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_thread_root BOOLEAN DEFAULT FALSE,
  parent_message_id UUID REFERENCES public.messages ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reactions table
CREATE TABLE public.reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  emoji_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji_code)
);

-- Enable Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for development - normally we'd check auth.uid())
CREATE POLICY "Allow all public access to profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow all public access to channels" ON public.channels FOR SELECT USING (true);
CREATE POLICY "Allow all public access to messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow all public access to reactions" ON public.reactions FOR SELECT USING (true);

-- In production, you'd restrict INSERT/UPDATE to authenticated users
CREATE POLICY "Allow all public inserts to messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all public inserts to profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all public inserts to reactions" ON public.reactions FOR INSERT WITH CHECK (true);
