ALTER TABLE events
ADD COLUMN IF NOT EXISTS app_user_id String;
