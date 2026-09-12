-- Run with the Supabase migration CLI or SQL editor. All game writes use the server connection.
CREATE TABLE rooms (id text PRIMARY KEY, code text NOT NULL UNIQUE, owner_id text NOT NULL, is_private integer NOT NULL, status text NOT NULL, revision integer NOT NULL, updated_at bigint NOT NULL, data text NOT NULL);
CREATE INDEX rooms_lobby ON rooms(status, is_private, updated_at);
CREATE INDEX rooms_owner ON rooms(owner_id, status);
CREATE TABLE ratings (id text PRIMARY KEY, user_id text NOT NULL, format text NOT NULL, name text NOT NULL, rating integer NOT NULL, peak integer NOT NULL DEFAULT 1000, games integer NOT NULL, wins integer NOT NULL);
CREATE INDEX ratings_leaderboard ON ratings(format, rating);
CREATE TABLE ranked_results (room_id text PRIMARY KEY, token text NOT NULL, rated integer NOT NULL DEFAULT 1, format text NOT NULL, created_at bigint NOT NULL, data text NOT NULL);
CREATE INDEX ranked_results_recent ON ranked_results(created_at);
CREATE TABLE matchmaking_queue (user_id text PRIMARY KEY, ticket text NOT NULL, name text NOT NULL, format text NOT NULL, rating integer NOT NULL, joined_at bigint NOT NULL, seen_at bigint NOT NULL, room_id text);
CREATE INDEX matchmaking_waiting ON matchmaking_queue(format, room_id, seen_at);
CREATE TABLE profiles (user_id text PRIMARY KEY, handle text NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9_]{3,20}$'), name text NOT NULL, bio text NOT NULL, created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint);
CREATE TABLE friendships (pair text PRIMARY KEY, sender text NOT NULL, recipient text NOT NULL, status text NOT NULL CHECK (status IN ('pending', 'accepted')));
CREATE TABLE global_messages (id text PRIMARY KEY, sequence serial UNIQUE, user_id text NOT NULL, author text NOT NULL, handle text, message text NOT NULL, at bigint NOT NULL);
CREATE INDEX global_messages_recent ON global_messages(at);
CREATE INDEX global_messages_sender ON global_messages(user_id, at);
CREATE TABLE match_history (room_id text NOT NULL, user_id text NOT NULL, mode text NOT NULL, format text NOT NULL, at bigint NOT NULL, won boolean NOT NULL, opponents text NOT NULL, score text NOT NULL, PRIMARY KEY(room_id, user_id));
CREATE INDEX match_history_player ON match_history(user_id, at DESC);
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranked_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;
-- No public policies: private hands, IDs and history are only accessible through authenticated server routes.
