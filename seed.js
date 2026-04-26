// Seeds the database with two demo sellers, a customer, products, and
// 14 days of randomized order history so the forecast widget has data.
const bcrypt = require('bcryptjs');
const db = require('./db');

console.log('Seeding...');

db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM products; DELETE FROM users;');

const hash = (p) => bcrypt.hashSync(p, 10);

const insUser = db.prepare(
  `INSERT INTO users (name, email, password_hash, role, shop_name, phone, address)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const seller1 = insUser.run('Ravi Kumar', 'ravi@uddan.test', hash('password'), 'seller', 'Ravi Fresh Farms', '9000000001', 'Sector 12, Noida').lastInsertRowid;
const seller2 = insUser.run('Priya Sharma', 'priya@uddan.test', hash('password'), 'seller', 'Priya Organics', '9000000002', 'Saket, Delhi').lastInsertRowid;
const customer = insUser.run('Amit Patel', 'amit@uddan.test', hash('password'), 'customer', null, '9000000003', 'Vasant Kunj, Delhi').lastInsertRowid;

const insProd = db.prepare(
  `INSERT INTO products (seller_id, name, category, price, unit, stock, image_url, description)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const products = [
  [seller1, 'Alphonso Mango', 'Fruits', 350, 'kg', 30, null, 'King of mangoes from Ratnagiri'],
  [seller1, 'Banana (Robusta)', 'Fruits', 60, 'dozen', 80, null, 'Sweet ripe bananas'],
  [seller1, 'Tomato', 'Vegetables', 40, 'kg', 50, null, 'Farm fresh tomatoes'],
  [seller1, 'Onion', 'Vegetables', 35, 'kg', 100, null, 'Premium quality'],
  [seller1, 'Coriander', 'Herbs', 15, 'bunch', 5, null, 'Fresh coriander'],
  [seller2, 'Apple (Shimla)', 'Fruits', 180, 'kg', 40, null, 'Crisp and juicy'],
  [seller2, 'Spinach', 'Leafy', 30, 'bunch', 60, null, 'Iron rich palak'],
  [seller2, 'Avocado', 'Exotic', 220, 'piece', 20, null, 'Imported, ripe'],
  [seller2, 'Carrot', 'Vegetables', 50, 'kg', 70, null, 'Sweet red carrots'],
  [seller2, 'Potato', 'Vegetables', 30, 'kg', 120, null, 'A-grade potatoes'],
];
const productIds = products.map(p => insProd.run(...p).lastInsertRowid);

// Generate fake order history over the past 14 days.
// Bias certain products to be "rising" (more sales in last 7 days) and others "falling".
const trendBias = {
  // last7Multiplier vs prev7
  [productIds[0]]: 2.2,  // Alphonso Mango — strongly rising (mango season)
  [productIds[5]]: 1.8,  // Apple — rising
  [productIds[7]]: 2.5,  // Avocado — rising sharply
  [productIds[2]]: 0.6,  // Tomato — falling
  [productIds[4]]: 0.3,  // Coriander — falling
  [productIds[3]]: 1.0,  // Onion — flat
};

const insOrder = db.prepare('INSERT INTO orders (customer_id, total, created_at) VALUES (?, ?, ?)');
const insItem = db.prepare(
  `INSERT INTO order_items (order_id, product_id, seller_id, product_name, quantity, price)
   VALUES (?, ?, ?, ?, ?, ?)`
);

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
  const inLastWeek = daysAgo <= 7;
  const ordersToday = rand(2, 5);
  for (let o = 0; o < ordersToday; o++) {
    const numItems = rand(1, 3);
    const picks = [];
    let total = 0;
    for (let i = 0; i < numItems; i++) {
      const pid = productIds[rand(0, productIds.length - 1)];
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(pid);
      const bias = trendBias[pid] || 1.2; // default slight rising
      const baseQty = rand(1, 4);
      const qty = inLastWeek
        ? Math.max(1, Math.round(baseQty * bias))
        : baseQty;
      picks.push({ product, qty });
      total += product.price * qty;
    }
    const ts = new Date(Date.now() - daysAgo * 86400000 + rand(0, 80000) * 1000).toISOString();
    const orderId = insOrder.run(customer, total, ts).lastInsertRowid;
    for (const { product, qty } of picks) {
      insItem.run(orderId, product.id, product.seller_id, product.name, qty, product.price);
    }
  }
}

console.log('Done. Try logging in with:');
console.log('  Customer: amit@uddan.test / password');
console.log('  Seller 1: ravi@uddan.test  / password');
console.log('  Seller 2: priya@uddan.test / password');
