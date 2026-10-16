CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pools (
  pair TEXT PRIMARY KEY,
  nft TEXT NOT NULL,
  nft_id TEXT,
  token TEXT,
  spot_price TEXT,
  delta TEXT,
  pool_type TEXT,
  owner TEXT,
  created_block INTEGER,
  created_tx TEXT
);

CREATE TABLE IF NOT EXISTS swaps (
  tx TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  pair TEXT NOT NULL,
  is_buy INTEGER NOT NULL,
  nft_count INTEGER,
  token_amount TEXT,
  block INTEGER,
  ts INTEGER,
  PRIMARY KEY (tx, log_index)
);

CREATE TABLE IF NOT EXISTS funds (
  id TEXT PRIMARY KEY,
  name TEXT,
  mechanism TEXT,
  pool TEXT,
  projects TEXT -- json array
);

CREATE TABLE IF NOT EXISTS contributions (
  tx TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  fund_id TEXT,
  project TEXT,
  contributor TEXT,
  amount TEXT,
  block INTEGER,
  PRIMARY KEY (tx, log_index)
);

CREATE TABLE IF NOT EXISTS claims (
  project TEXT PRIMARY KEY,
  shortfall TEXT,
  status TEXT DEFAULT 'unclaimed', -- unclaimed|pending|claimed|disputed
  wallet TEXT,
  telegram_chat TEXT,
  attestation TEXT,
  claimed_at INTEGER
);

CREATE TABLE IF NOT EXISTS artifacts (
  token_id TEXT PRIMARY KEY,
  project TEXT,
  metadata_uri TEXT,
  uri_alive INTEGER,
  total_supply TEXT,
  first_block INTEGER
);
