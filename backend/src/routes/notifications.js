const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// List notifications (optional filter by user or channel)
router.get('/', (req, res) => {
  try {
    const { user_id, channel } = req.query;
    let query = `
      SELECT n.*, u.name as user_name, u.phone, u.role
      FROM notifications n
      JOIN users u ON n.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (user_id) {
      query += ' AND n.user_id = ?';
      params.push(user_id);
    }
    if (channel) {
      query += ' AND n.channel = ?';
      params.push(channel);
    }
    query += ' ORDER BY n.created_at DESC';

    const stmt = db.prepare(query);
    const notifications = stmt.all(...params);
    res.json({ success: true, count: notifications.length, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simulate WhatsApp Cloud API message trigger
router.post('/whatsapp-dispatch', (req, res) => {
  try {
    const { user_id, template_name, phone, params } = req.body;
    const notifId = 'notif-wa-' + Date.now();

    const title = `WhatsApp [${template_name || 'RENEWAL_REMINDER'}]`;
    const message = `[Template: ${template_name}] To ${phone || 'User'}: Verification status updated for your weighing instrument under Legal Metrology Rules.`;

    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(notifId, user_id || 'usr-mer-01', title, message, 'whatsapp', 'DELIVERED');

    res.json({
      success: true,
      channel: 'whatsapp_cloud_api',
      delivery_status: 'SENT',
      message_id: 'wamid.' + Date.now(),
      template: template_name,
      recipient: phone
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
