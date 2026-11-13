export const migration = `
CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY,email text NOT NULL UNIQUE,password_hash text,role text NOT NULL CHECK(role IN ('customer','manager','owner')),must_change_password boolean NOT NULL DEFAULT false,temporary_password_expires_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS products (id text PRIMARY KEY,slug text NOT NULL UNIQUE,category text NOT NULL,gender text NOT NULL,brand text NOT NULL,names jsonb NOT NULL,description jsonb NOT NULL,price integer NOT NULL CHECK(price>=0),old_price integer CHECK(old_price>=0),media jsonb NOT NULL DEFAULT '[]',kaspi_url text,is_demo boolean NOT NULL DEFAULT false,published boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS variants (id text PRIMARY KEY,product_id text NOT NULL REFERENCES products(id),size text NOT NULL,color text NOT NULL,UNIQUE(product_id,size,color));
CREATE TABLE IF NOT EXISTS inventory (variant_id text NOT NULL REFERENCES variants(id),branch_id text NOT NULL,quantity integer NOT NULL DEFAULT 0 CHECK(quantity>=0),reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=quantity),PRIMARY KEY(variant_id,branch_id));
CREATE TABLE IF NOT EXISTS carts (visitor_id text NOT NULL,variant_id text NOT NULL REFERENCES variants(id),quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 50),PRIMARY KEY(visitor_id,variant_id));
CREATE TABLE IF NOT EXISTS favorites (visitor_id text NOT NULL,product_id text NOT NULL REFERENCES products(id),PRIMARY KEY(visitor_id,product_id));
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),realm text NOT NULL CHECK(realm IN ('buyer','staff')),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS password_tokens (token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),kind text NOT NULL CHECK(kind IN ('reset','claim')),realm text NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz);
CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY,visitor_id text NOT NULL,user_id text REFERENCES users(id),email text NOT NULL,phone text NOT NULL,fulfillment text NOT NULL DEFAULT 'pickup' CHECK(fulfillment='pickup'),locale text NOT NULL CHECK(locale IN ('ru','kk','en')),status text NOT NULL,total integer NOT NULL CHECK(total>=0),lines jsonb NOT NULL,idempotency_key text NOT NULL,request_hash text NOT NULL,access_token_hash text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(visitor_id,idempotency_key));
CREATE TABLE IF NOT EXISTS reservations (order_id text NOT NULL REFERENCES orders(id),variant_id text NOT NULL REFERENCES variants(id),branch_id text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),state text NOT NULL CHECK(state IN ('reserved','consumed','released')),PRIMARY KEY(order_id,variant_id,branch_id));
CREATE TABLE IF NOT EXISTS payments (id text PRIMARY KEY,order_id text NOT NULL UNIQUE REFERENCES orders(id),invoice_id text UNIQUE,amount integer NOT NULL,environment text NOT NULL,status text NOT NULL,payment_url text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS payment_events (event_id text PRIMARY KEY,order_id text NOT NULL REFERENCES orders(id),event_type text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS jobs (id text PRIMARY KEY,type text NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','failed')),attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),locked_at timestamptz,locked_by text,last_error text);
CREATE INDEX IF NOT EXISTS jobs_pending_idx ON jobs(status,available_at);
CREATE TABLE IF NOT EXISTS audit (id text PRIMARY KEY,actor_id text,action text NOT NULL,entity_id text,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS settings (id text PRIMARY KEY,value jsonb NOT NULL);
INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS payments_reconciliation_idx ON payments(last_checked_at,created_at,id) WHERE invoice_id IS NOT NULL AND status<>'refunded';
INSERT INTO schema_migrations(version) VALUES (2) ON CONFLICT DO NOTHING;
ALTER TABLE products ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS promotion jsonb;
INSERT INTO schema_migrations(version) VALUES (3) ON CONFLICT DO NOTHING;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'apipay' CHECK(method IN ('apipay','wallet'));
CREATE TABLE IF NOT EXISTS wallets (
 user_id text NOT NULL REFERENCES users(id),environment text NOT NULL CHECK(environment IN ('mock','sandbox','production')),
 currency text NOT NULL DEFAULT 'KZT' CHECK(currency='KZT'),balance integer NOT NULL DEFAULT 0 CHECK(balance>=0),frozen boolean NOT NULL DEFAULT false,
 PRIMARY KEY(user_id,environment));
CREATE TABLE IF NOT EXISTS wallet_topups (
 id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),environment text NOT NULL CHECK(environment IN ('mock','sandbox','production')),
 amount integer NOT NULL CHECK(amount BETWEEN 1 AND 100000000),phone text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled','expired','error','refunded','manual_review')),
 invoice_id text UNIQUE,idempotency_key text NOT NULL,request_hash text NOT NULL,refunded_amount integer NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount<=amount),
 last_checked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,environment,idempotency_key),
 FOREIGN KEY(user_id,environment) REFERENCES wallets(user_id,environment));
CREATE TABLE IF NOT EXISTS wallet_entries (
 id text PRIMARY KEY,user_id text NOT NULL,environment text NOT NULL,kind text NOT NULL CHECK(kind IN ('topup_credit','order_debit','order_refund','topup_reversal')),
 amount integer NOT NULL CHECK(amount>0),balance_after integer NOT NULL CHECK(balance_after>=0),topup_id text REFERENCES wallet_topups(id),order_id text REFERENCES orders(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,environment) REFERENCES wallets(user_id,environment),
 CHECK((kind IN ('topup_credit','topup_reversal') AND topup_id IS NOT NULL AND order_id IS NULL) OR (kind IN ('order_debit','order_refund') AND order_id IS NOT NULL AND topup_id IS NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS wallet_topup_credit_once ON wallet_entries(topup_id) WHERE kind='topup_credit';
CREATE UNIQUE INDEX IF NOT EXISTS wallet_order_debit_once ON wallet_entries(order_id) WHERE kind='order_debit';
CREATE UNIQUE INDEX IF NOT EXISTS wallet_order_refund_once ON wallet_entries(order_id) WHERE kind='order_refund';
CREATE INDEX IF NOT EXISTS wallet_entries_owner ON wallet_entries(user_id,environment,created_at,id);
CREATE TABLE IF NOT EXISTS wallet_topup_events (
 event_id text PRIMARY KEY,topup_id text NOT NULL REFERENCES wallet_topups(id),event_type text NOT NULL,payload jsonb NOT NULL,resolved boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION protect_wallet_ledger() RETURNS trigger LANGUAGE plpgsql AS $wallet$
 BEGIN RAISE EXCEPTION 'Wallet ledger entries are immutable'; END; $wallet$;
DROP TRIGGER IF EXISTS wallet_ledger_immutable ON wallet_entries;
CREATE TRIGGER wallet_ledger_immutable BEFORE UPDATE OR DELETE ON wallet_entries FOR EACH ROW EXECUTE FUNCTION protect_wallet_ledger();
INSERT INTO schema_migrations(version) VALUES (4) ON CONFLICT DO NOTHING;
ALTER TABLE products ADD COLUMN IF NOT EXISTS article text;
ALTER TABLE variants ADD COLUMN IF NOT EXISTS barcode text;
INSERT INTO schema_migrations(version) VALUES (5) ON CONFLICT DO NOTHING;
`;
