require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/forecast', require('./routes/forecast'));

app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  });
});

// Serve static frontend
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
app.get('/', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Digital Uddan running at http://localhost:${PORT}`);
});
