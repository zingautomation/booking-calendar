require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public')));

const bookingTemplate = fs.readFileSync(
  path.join(__dirname, 'views', 'book.html'),
  'utf8'
);

app.get('/', (req, res) => {
  res.send(
    '<h1>Booking Calendar</h1>' +
    '<p>Visit <code>/book/&lt;client-name&gt;</code> to access a booking page.</p>' +
    '<p>Examples: <a href="/book/acme-dental">/book/acme-dental</a>, <a href="/book/sunrise-salon">/book/sunrise-salon</a></p>'
  );
});

app.get('/book/:clientId', (req, res) => {
  const { clientId } = req.params;
  if (!/^[a-z0-9-]+$/i.test(clientId)) {
    return res.status(400).send('Invalid client ID. Use letters, numbers, and dashes only.');
  }
  const displayName = clientId.replace(/-/g, ' ');
  const html = bookingTemplate
    .replace(/{{CLIENT_ID}}/g, clientId)
    .replace(/{{CLIENT_NAME}}/g, displayName);
  res.send(html);
});

app.get('/api/slots/:clientId', (req, res) => {
  const { clientId } = req.params;
  if (!/^[a-z0-9-]+$/i.test(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'clients.json'), 'utf8');
    const clients = JSON.parse(raw);
    const config = clients[clientId] || clients.default;
    if (!config || typeof config.schedule !== 'object' || config.schedule === null) {
      return res.status(500).json({ error: 'No schedule configured for this client and no default fallback.' });
    }
    res.json({ clientId, schedule: config.schedule, isDefault: !clients[clientId] });
  } catch (err) {
    console.error('Failed to load clients.json:', err);
    res.status(500).json({ error: 'Failed to load schedule.' });
  }
});

app.post('/api/book', async (req, res) => {
  const { clientId, leadName, leadPhone, appointmentDateTime } = req.body || {};

  if (!clientId || !leadName || !leadPhone || !appointmentDateTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!MAKE_WEBHOOK_URL) {
    console.error('MAKE_WEBHOOK_URL is not set in environment.');
    return res.status(500).json({ error: 'Server is not configured to send bookings.' });
  }

  const payload = {
    clientId,
    leadName,
    leadPhone,
    appointmentDateTime,
    submittedAt: new Date().toISOString()
  };

  try {
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Webhook responded ${response.status}: ${body}`);
      return res.status(502).json({ error: 'Webhook rejected the booking.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook call failed:', err);
    res.status(502).json({ error: 'Failed to reach booking webhook.' });
  }
});

app.listen(PORT, () => {
  console.log(`Booking calendar running at http://localhost:${PORT}`);
  if (!MAKE_WEBHOOK_URL) {
    console.warn('Warning: MAKE_WEBHOOK_URL is not set. Form submissions will fail until you set it in .env');
  }
});
