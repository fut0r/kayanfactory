const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../config/database');
const emailService = require('../services/emailService');

const router = express.Router();

// Validation rules
const contactValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('الاسم يجب أن يكون بين 2 و 100 حرف')
    .matches(/^[\u0600-\u06FF\s\w]+$/)
    .withMessage('الاسم يجب أن يحتوي على أحرف صحيحة فقط'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('البريد الإلكتروني غير صحيح'),
  
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('رقم الهاتف يجب أن يكون بين 10 و 20 رقم')
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('رقم الهاتف يحتوي على أحرف غير صحيحة'),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('الرسالة يجب أن تكون بين 10 و 2000 حرف')
];

// POST /api/contact - Submit contact form
router.post('/', contactValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير صحيحة',
        errors: errors.array()
      });
    }

    const { name, email, phone, message } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Insert contact message into database
    const result = await database.run(
      `INSERT INTO contact_messages (name, email, phone, message, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, phone || null, message, ipAddress, userAgent]
    );

    const contactData = {
      id: result.id,
      name,
      email,
      phone,
      message
    };

    // Send notification email to admin
    try {
      await emailService.sendContactNotification(contactData);
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the request if email fails
    }

    // Send auto-reply to customer
    try {
      await emailService.sendAutoReply(email, name, 'contact');
    } catch (emailError) {
      console.error('Failed to send auto-reply:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.',
      data: {
        id: result.id,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إرسال الرسالة. يرجى المحاولة مرة أخرى.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/contact - Get contact messages (admin only)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (status !== 'all') {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }

    const messages = await database.query(
      `SELECT id, name, email, phone, message, status, created_at, responded_at
       FROM contact_messages 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalCount = await database.get(
      `SELECT COUNT(*) as count FROM contact_messages ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount.count,
          pages: Math.ceil(totalCount.count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الرسائل',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/contact/:id - Get specific contact message
// Place more specific routes before dynamic ':id' route
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await database.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_messages,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_messages,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied_messages,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_messages,
        SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as today_messages,
        SUM(CASE WHEN DATE(created_at) >= DATE('now', '-7 days') THEN 1 ELSE 0 END) as week_messages
      FROM contact_messages
    `);

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إحصائيات الرسائل',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const message = await database.get(
      'SELECT * FROM contact_messages WHERE id = ?',
      [id]
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'الرسالة غير موجودة'
      });
    }

    res.json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('Get contact message error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الرسالة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/contact/:id/status - Update message status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response } = req.body;

    if (!['new', 'read', 'replied', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة'
      });
    }

    const updateData = {
      status,
      ...(response && { response }),
      ...(status === 'replied' && { responded_at: new Date().toISOString() })
    };

    const result = await database.run(
      `UPDATE contact_messages 
       SET status = ?, response = ?, responded_at = ?
       WHERE id = ?`,
      [status, response || null, updateData.responded_at || null, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'الرسالة غير موجودة'
      });
    }

    res.json({
      success: true,
      message: 'تم تحديث حالة الرسالة بنجاح'
    });

  } catch (error) {
    console.error('Update message status error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث حالة الرسالة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/contact/:id - Delete contact message
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await database.run(
      'DELETE FROM contact_messages WHERE id = ?',
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'الرسالة غير موجودة'
      });
    }

    res.json({
      success: true,
      message: 'تم حذف الرسالة بنجاح'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حذف الرسالة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// (stats route moved above)

module.exports = router;
