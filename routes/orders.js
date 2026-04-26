const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/', authRequired(['customer']), (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items required' });
  }

  const placeOrder = db.transaction((customerId, items) => {
    let total = 0;
    const resolved = [];
    for (const it of items) {
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
      if (!p) throw new Error(`Product ${it.product_id} not found`);
      const qty = Number(it.quantity) || 1;
      if (p.stock < qty) throw new Error(`Insufficient stock for ${p.name}`);
      total += p.price * qty;
      resolved.push({ p, qty });
    }
    const order = db.prepare('INSERT INTO orders (customer_id, total) VALUES (?, ?)')
      .run(customerId, total);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, seller_id, product_name, quantity, price)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const { p, qty } of resolved) {
      insertItem.run(order.lastInsertRowid, p.id, p.seller_id, p.name, qty, p.price);
      updateStock.run(qty, p.id);
    }
    return { order_id: order.lastInsertRowid, total };
  });

  try {
    const result = placeOrder(req.user.id, items);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/mine', authRequired(['customer']), (req, res) => {
  const orders = db.prepare(
    'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  for (const o of orders) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  }
  res.json(orders);
});

router.get('/seller', authRequired(['seller']), (req, res) => {
  const items = db.prepare(
    `SELECT oi.*, o.created_at AS order_date, o.status
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.seller_id = ? ORDER BY o.created_at DESC LIMIT 200`
  ).all(req.user.id);
  res.json(items);
});

module.exports = router;
