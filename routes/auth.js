const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, shop_name: u.shop_name };
}

router.post('/signup', (req, res) => {
  const { name, email, password, role, shop_name, phone, address } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, role required' });
  }
  if (!['customer', 'seller'].includes(role)) {
    return res.status(400).json({ error: 'invalid role' });
  }
  if (role === 'seller' && !shop_name) {
    return res.status(400).json({ error: 'shop_name required for sellers' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, shop_name, phone, address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(name, email, hash, role, shop_name || null, phone || null, address || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ token: issueToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
  if (role && user.role !== role) {
    return res.status(403).json({ error: `This account is registered as a ${user.role}` });
  }
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: issueToken(user), user: publicUser(user) });
});

router.post('/google', async (req, res) => {
  const { credential, role } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'credential (Google ID token) required' });
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.startsWith('your-')) {
    return res.status(500).json({ error: 'Google Sign-In not configured. Set GOOGLE_CLIENT_ID in .env' });
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(googleId, email);
    if (!user) {
      const newRole = role === 'seller' ? 'seller' : 'customer';
      const info = db.prepare(
        `INSERT INTO users (name, email, google_id, role) VALUES (?, ?, ?, ?)`
      ).run(name || email.split('@')[0], email, googleId, newRole);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else if (!user.google_id) {
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
      user.google_id = googleId;
    }
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (e) {
    console.error('Google verify failed:', e.message);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

module.exports = router;
