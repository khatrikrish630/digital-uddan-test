const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Forecast: for each product owned by this seller, compare last 7 days vs prior 7 days
// of unit sales. Rank by growth rate. Also project next-7-day demand using a
// weighted moving average (recent week weighted 0.7, prior week 0.3).
router.get('/seller', authRequired(['seller']), (req, res) => {
  const sellerId = req.user.id;

  const products = db.prepare(
    'SELECT id, name, category, stock, unit FROM products WHERE seller_id = ?'
  ).all(sellerId);

  const recent = db.prepare(`
    SELECT product_id, COALESCE(SUM(quantity),0) AS qty
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.seller_id = ? AND o.created_at >= datetime('now','-7 days')
    GROUP BY product_id
  `).all(sellerId);
  const prior = db.prepare(`
    SELECT product_id, COALESCE(SUM(quantity),0) AS qty
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.seller_id = ?
      AND o.created_at >= datetime('now','-14 days')
      AND o.created_at <  datetime('now','-7 days')
    GROUP BY product_id
  `).all(sellerId);

  const recentMap = Object.fromEntries(recent.map(r => [r.product_id, r.qty]));
  const priorMap  = Object.fromEntries(prior.map(r => [r.product_id, r.qty]));

  const rows = products.map(p => {
    const r = recentMap[p.id] || 0;
    const pr = priorMap[p.id] || 0;
    let growth;
    if (pr === 0 && r === 0) growth = 0;
    else if (pr === 0) growth = 1; // brand-new traction; cap at +100%
    else growth = (r - pr) / pr;
    const forecastNext7 = Math.round(0.7 * r + 0.3 * pr);
    const daysOfStock = forecastNext7 > 0
      ? Math.round((p.stock / forecastNext7) * 7)
      : null;
    let trend = 'flat';
    if (growth > 0.15) trend = 'rising';
    else if (growth < -0.15) trend = 'falling';
    return {
      product_id: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      stock: p.stock,
      sold_last_7: r,
      sold_prev_7: pr,
      growth_pct: Math.round(growth * 100),
      forecast_next_7: forecastNext7,
      days_of_stock: daysOfStock,
      trend,
    };
  });

  // Sort: rising trend first, then by absolute volume of recent sales
  rows.sort((a, b) => {
    if (a.trend !== b.trend) {
      const order = { rising: 0, flat: 1, falling: 2 };
      return order[a.trend] - order[b.trend];
    }
    return b.sold_last_7 - a.sold_last_7;
  });

  const summary = {
    total_units_last_7: rows.reduce((s, r) => s + r.sold_last_7, 0),
    total_units_prev_7: rows.reduce((s, r) => s + r.sold_prev_7, 0),
    rising: rows.filter(r => r.trend === 'rising').slice(0, 5).map(r => r.name),
    falling: rows.filter(r => r.trend === 'falling').slice(0, 5).map(r => r.name),
    low_stock: rows
      .filter(r => r.days_of_stock != null && r.days_of_stock < 7)
      .map(r => ({ name: r.name, days_of_stock: r.days_of_stock })),
  };

  res.json({ summary, products: rows });
});

module.exports = router;
