
CREATE TABLE public.mt5_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  firm TEXT NOT NULL,
  login BIGINT NOT NULL,
  server TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  account_name TEXT,
  balance NUMERIC DEFAULT 0,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.mt5_accounts(id) ON DELETE CASCADE,
  ticket BIGINT,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry NUMERIC,
  exit_price NUMERIC,
  sl NUMERIC,
  tp NUMERIC,
  volume NUMERIC,
  profit NUMERIC,
  commission NUMERIC,
  open_time TIMESTAMP WITH TIME ZONE,
  close_time TIMESTAMP WITH TIME ZONE,
  duration TEXT,
  setup_tag TEXT DEFAULT 'Other',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  language TEXT DEFAULT 'ar',
  theme TEXT DEFAULT 'dark',
  timezone TEXT DEFAULT 'Africa/Algiers',
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.mt5_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mt5 accounts" ON public.mt5_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own mt5 accounts" ON public.mt5_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mt5 accounts" ON public.mt5_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mt5 accounts" ON public.mt5_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own preferences" ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);
