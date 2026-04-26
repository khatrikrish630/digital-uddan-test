const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('customer','seller')),
  shop_name TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (seller_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
`);

module.exports = db;
