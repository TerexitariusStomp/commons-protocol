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

CREATE TABLE IF NOT EXISTS flow_policies (
  node TEXT PRIMARY KEY,        -- graph node id (project/fund/person slug)
  address TEXT,                 -- on-chain account the band watches
  floor REAL NOT NULL,
  ceiling REAL NOT NULL,
  gradient REAL DEFAULT 0,      -- 0 hard switch .. 1 smooth ramp
  per_claimant_cap REAL DEFAULT 0.34,
  per_epoch_cap REAL DEFAULT 0.10,
  denomination TEXT DEFAULT 'stable',
  enabled INTEGER DEFAULT 1,
  created_at INTEGER, updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS flow_agreements (
  id TEXT PRIMARY KEY,
  from_node TEXT NOT NULL,
  to_node TEXT NOT NULL,
  trust_weight REAL DEFAULT 1,
  formality REAL DEFAULT 0,     -- 0 relational .. 1 codified
  tier TEXT DEFAULT 'relational', -- relational|channel|revenue-share|contract
  share_pct REAL,
  expires_at INTEGER,
  status TEXT DEFAULT 'proposed',  -- proposed|active|revoked (bilateral accept)
  proposer_sig TEXT, accepter_sig TEXT,
  created_at INTEGER, updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS flow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epoch INTEGER NOT NULL,
  from_node TEXT NOT NULL,
  to_node TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'computed', -- computed|settled|refused|attested
  tx TEXT, eas_uid TEXT,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_flow_events_epoch ON flow_events(epoch);
