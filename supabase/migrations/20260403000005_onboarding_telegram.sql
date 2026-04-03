ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS telegram_chat_id text;
