const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const { category, q } = req.query;
  let sql = `SELECT p.*, u.shop_name FROM products p
             JOIN users u ON u.id = p.seller_id
             WHERE p.stock > 0`;
  const params = [];
  if (category) { sql += ' AND p.category = ?'; params.push(category); }
  if (q) { sql += ' AND p.name LIKE ?'; params.push(`%${q}%`); }
  sql += ' ORDER BY p.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  res.json(rows.map(r => r.category));
});

router.get('/:id', (req, res) => {
  const product = db.prepare(
    `SELECT p.*, u.shop_name FROM products p
     JOIN users u ON u.id = p.seller_id WHERE p.id = ?`
  ).get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

router.get('/seller/mine', authRequired(['seller']), (req, res) => {
  const products = db.prepare(
    'SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json(products);
});

router.post('/', authRequired(['seller']), (req, res) => {
  const { name, category, price, unit, stock, image_url, description } = req.body || {};
  if (!name || !category || price == null) {
    return res.status(400).json({ error: 'name, category, price required' });
  }
  const info = db.prepare(
    `INSERT INTO products (seller_id, name, category, price, unit, stock, image_url, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.id, name, category, Number(price),
    unit || 'kg', Number(stock) || 0, image_url || null, description || null
  );
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', authRequired(['seller']), (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });
  if (product.seller_id !== req.user.id) return res.status(403).json({ error: 'Not your product' });

  const { name, category, price, unit, stock, image_url, description } = req.body || {};
  db.prepare(
    `UPDATE products SET name=?, category=?, price=?, unit=?, stock=?, image_url=?, description=? WHERE id=?`
  ).run(
    name ?? product.name,
    category ?? product.category,
    price != null ? Number(price) : product.price,
    unit ?? product.unit,
    stock != null ? Number(stock) : product.stock,
    image_url ?? product.image_url,
    description ?? product.description,
    product.id
  );
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(product.id));
});

router.delete('/:id', authRequired(['seller']), (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });
  if (product.seller_id !== req.user.id) return res.status(403).json({ error: 'Not your product' });
  db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
  res.json({ ok: true });
});

module.exports = router;
