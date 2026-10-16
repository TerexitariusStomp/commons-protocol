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
  buyer TEXT,
  seller TEXT,
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
  projects TEXT, -- json array
  description TEXT
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
  name TEXT,
  description TEXT,
  royalty_bps INTEGER,
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

-- ---- marketplace (liteflow-compatible graphql substrate) ----

CREATE TABLE IF NOT EXISTS collections (
  chain_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  name TEXT,
  image TEXT,
  cover TEXT,
  description TEXT,
  standard TEXT DEFAULT 'ERC1155',
  deployer TEXT,
  volume_ref TEXT,
  floor_price TEXT,
  total_sales INTEGER DEFAULT 0,
  total_owners INTEGER DEFAULT 0,
  total_supply TEXT,
  verified INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  PRIMARY KEY (chain_id, address)
);

CREATE TABLE IF NOT EXISTS assets (
  chain_id INTEGER NOT NULL,
  collection_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  name TEXT,
  image TEXT,
  image_mimetype TEXT,
  animation_url TEXT,
  animation_mimetype TEXT,
  quantity TEXT DEFAULT '1',
  creator TEXT,
  description TEXT,
  token_uri TEXT,
  listings_count INTEGER DEFAULT 0,
  listings_currency_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  PRIMARY KEY (chain_id, collection_address, token_id)
);

CREATE TABLE IF NOT EXISTS ownerships (
  chain_id INTEGER NOT NULL,
  collection_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  quantity TEXT NOT NULL,
  asset_name TEXT,
  asset_image TEXT,
  asset_image_mimetype TEXT,
  asset_animation_url TEXT,
  PRIMARY KEY (chain_id, collection_address, token_id, owner_address)
);

CREATE TABLE IF NOT EXISTS asset_traits (
  chain_id INTEGER NOT NULL,
  collection_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (chain_id, collection_address, token_id, type, value)
);

CREATE TABLE IF NOT EXISTS collection_traits (
  chain_id INTEGER NOT NULL,
  collection_address TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (chain_id, collection_address, type, value)
);

CREATE TABLE IF NOT EXISTS asset_events (
  chain_id INTEGER,
  collection_address TEXT,
  token_id TEXT,
  action TEXT,
  ts INTEGER,
  unit_price TEXT,
  quantity TEXT,
  from_address TEXT,
  to_address TEXT,
  tx TEXT,
  block INTEGER
);

CREATE TABLE IF NOT EXISTS accounts (
  address TEXT PRIMARY KEY,
  name TEXT,
  username TEXT,
  description TEXT,
  twitter TEXT,
  instagram TEXT,
  website TEXT,
  email TEXT,
  image TEXT,
  cover TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS currencies (
  chain_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  decimals INTEGER DEFAULT 18,
  symbol TEXT,
  name TEXT,
  image TEXT,
  PRIMARY KEY (chain_id, address)
);

CREATE TABLE IF NOT EXISTS royalties (
  chain_id INTEGER NOT NULL,
  collection_address TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (chain_id, collection_address)
);

CREATE TABLE IF NOT EXISTS pool_inventory (
  pair TEXT NOT NULL,
  nft_id TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  PRIMARY KEY (pair, nft_id)
);
