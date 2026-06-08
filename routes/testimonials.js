const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../config/database');
const emailService = require('../services/emailService');

const router = express.Router();

// Validation rules
const testimonialValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('الاسم يجب أن يكون بين 2 و 100 حرف')
    .matches(/^[\u0600-\u06FF\s\w]+$/)
    .withMessage('الاسم يجب أن يحتوي على أحرف صحيحة فقط'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('البريد الإلكتروني غير صحيح'),
  
  body('service')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('نوع الخدمة يجب أن يكون بين 2 و 100 حرف')
    .isIn([
      'curtain-wall', 'cladding', 'aluminum-windows', 
      'upvc-windows', 'wpc-doors', 'shower-cabins', 
      'railings', 'roller-shutters', 'glass-partitions', 
      'kitchens', 'other'
    ])
    .withMessage('نوع الخدمة غير صحيح'),
  
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('التقييم يجب أن يكون بين 1 و 5'),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('التعليق يجب أن يكون بين 10 و 1000 حرف')
];

// Service names mapping
const serviceNames = {
  'curtain-wall': 'كرتن وول',
  'cladding': 'كلادينج',
  'aluminum-windows': 'نوافذ ألمنيوم',
  'upvc-windows': 'نوافذ UPVC',
  'wpc-doors': 'أبواب WPC',
  'shower-cabins': 'كابائن الدش',
  'railings': 'درابزين',
  'roller-shutters': 'رولر شتر',
  'glass-partitions': 'قواطع زجاجية',
  'kitchens': 'مطابخ',
  'other': 'أخرى'
};

// POST /api/testimonials - Submit testimonial
router.post('/', testimonialValidation, async (req, res) => {
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

    const { name, email, service, rating, message } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Check for duplicate testimonials from same IP in last 24 hours
    const recentTestimonial = await database.get(
      'SELECT id FROM testimonials WHERE ip_address = ? AND created_at > datetime("now", "-1 day")',
      [ipAddress]
    );

    if (recentTestimonial) {
      return res.status(429).json({
        success: false,
        message: 'يمكنك إرسال تقييم واحد فقط كل 24 ساعة'
      });
    }

    // Insert testimonial into database
    const result = await database.run(
      `INSERT INTO testimonials (name, email, service, rating, message, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email || null, service, rating, message, ipAddress, userAgent]
    );

    const testimonialData = {
      id: result.id,
      name,
      email,
      service: serviceNames[service] || service,
      rating,
      message
    };

    // Send notification email to admin
    try {
      await emailService.sendTestimonialNotification(testimonialData);
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the request if email fails
    }

    // Send auto-reply to customer if email provided
    if (email) {
      try {
        await emailService.sendAutoReply(email, name, 'testimonial');
      } catch (emailError) {
        console.error('Failed to send auto-reply:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'شكراً لك! تم إرسال تقييمك بنجاح. سيتم مراجعته ونشره قريباً.',
      data: {
        id: result.id,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Testimonial submission error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إرسال التقييم. يرجى المحاولة مرة أخرى.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/testimonials - Get testimonials
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'approved', 
      service = 'all',
      rating = 'all',
      sort = 'newest'
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Filter by status
    if (status !== 'all') {
      if (status === 'approved') {
        whereClause += ' AND approved = 1';
      } else if (status === 'pending') {
        whereClause += ' AND approved = 0';
      } else {
        whereClause += ' AND status = ?';
        params.push(status);
      }
    }

    // Filter by service
    if (service !== 'all') {
      whereClause += ' AND service = ?';
      params.push(service);
    }

    // Filter by rating
    if (rating !== 'all') {
      whereClause += ' AND rating = ?';
      params.push(parseInt(rating));
    }

    // Sort order
    let orderBy = 'ORDER BY created_at DESC';
    if (sort === 'oldest') {
      orderBy = 'ORDER BY created_at ASC';
    } else if (sort === 'rating_high') {
      orderBy = 'ORDER BY rating DESC, created_at DESC';
    } else if (sort === 'rating_low') {
      orderBy = 'ORDER BY rating ASC, created_at DESC';
    }

    const testimonials = await database.query(
      `SELECT id, name, service, rating, message, created_at, approved
       FROM testimonials 
       ${whereClause}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalCount = await database.get(
      `SELECT COUNT(*) as count FROM testimonials ${whereClause}`,
      params
    );

    // Get average rating
    const avgRating = await database.get(
      `SELECT AVG(rating) as average, COUNT(*) as count 
       FROM testimonials 
       WHERE approved = 1`
    );

    res.json({
      success: true,
      data: {
        testimonials,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount.count,
          pages: Math.ceil(totalCount.count / limit)
        },
        statistics: {
          averageRating: avgRating.average ? parseFloat(avgRating.average.toFixed(1)) : 0,
          totalApproved: avgRating.count
        }
      }
    });

  } catch (error) {
    console.error('Get testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التقييمات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/testimonials/public - Get public testimonials (approved only)
router.get('/public', async (req, res) => {
  try {
    const { limit = 20, service = 'all' } = req.query;

    let whereClause = 'WHERE approved = 1';
    let params = [];

    if (service !== 'all') {
      whereClause += ' AND service = ?';
      params.push(service);
    }

    const testimonials = await database.query(
      `SELECT name, service, rating, message, created_at
       FROM testimonials 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    res.json({
      success: true,
      data: testimonials
    });

  } catch (error) {
    console.error('Get public testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التقييمات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/testimonials/:id/approve - Approve testimonial
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, admin_notes } = req.body;

    const result = await database.run(
      `UPDATE testimonials 
       SET approved = ?, admin_notes = ?, approved_at = ?
       WHERE id = ?`,
      [approved ? 1 : 0, admin_notes || null, approved ? new Date().toISOString() : null, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'التقييم غير موجود'
      });
    }

    res.json({
      success: true,
      message: approved ? 'تم الموافقة على التقييم' : 'تم رفض التقييم'
    });

  } catch (error) {
    console.error('Approve testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث التقييم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/testimonials/:id - Delete testimonial
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await database.run(
      'DELETE FROM testimonials WHERE id = ?',
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'التقييم غير موجود'
      });
    }

    res.json({
      success: true,
      message: 'تم حذف التقييم بنجاح'
    });

  } catch (error) {
    console.error('Delete testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حذف التقييم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/testimonials/stats/summary - Get testimonial statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await database.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN approved = 1 THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN approved = 0 THEN 1 ELSE 0 END) as pending,
        AVG(rating) as average_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star,
        SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN DATE(created_at) >= DATE('now', '-7 days') THEN 1 ELSE 0 END) as this_week
      FROM testimonials
    `);

    const serviceStats = await database.query(`
      SELECT service, COUNT(*) as count, AVG(rating) as avg_rating
      FROM testimonials 
      WHERE approved = 1
      GROUP BY service
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        ...stats[0],
        average_rating: stats[0].average_rating ? parseFloat(stats[0].average_rating.toFixed(1)) : 0,
        service_breakdown: serviceStats
      }
    });

  } catch (error) {
    console.error('Get testimonial stats error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إحصائيات التقييمات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
