-- Make MT5 connection fields optional (no longer required for manual accounts)
ALTER TABLE mt5_accounts ALTER COLUMN login DROP NOT NULL;
ALTER TABLE mt5_accounts ALTER COLUMN password_encrypted DROP NOT NULL;
ALTER TABLE mt5_accounts ALTER COLUMN server DROP NOT NULL;

-- New fields for Account Manager
ALTER TABLE mt5_accounts ADD COLUMN IF NOT EXISTS account_type       text;
ALTER TABLE mt5_accounts ADD COLUMN IF NOT EXISTS account_size       numeric;
ALTER TABLE mt5_accounts ADD COLUMN IF NOT EXISTS starting_balance   numeric;
ALTER TABLE mt5_accounts ADD COLUMN IF NOT EXISTS profit_target      numeric DEFAULT 10;
ALTER TABLE mt5_accounts ADD COLUMN IF NOT EXISTS max_drawdown_limit numeric DEFAULT 10;
ALTER TABLE mt5_accounts ADD COLUMN IF NOT EXISTS daily_loss_limit   numeric DEFAULT 5;
ALTER TABLE mt5_accounts ADD COLUMN IF NOT EXISTS currency           text    DEFAULT 'USD';
