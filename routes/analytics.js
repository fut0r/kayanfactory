const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Validation rules
const visitValidation = [
  body('page_url')
    .trim()
    .isURL()
    .withMessage('رابط الصفحة غير صحيح'),
  
  body('page_title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('عنوان الصفحة طويل جداً'),
  
  body('referrer')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('المصدر طويل جداً'),
  
  body('device_type')
    .optional()
    .isIn(['desktop', 'mobile', 'tablet'])
    .withMessage('نوع الجهاز غير صحيح'),
  
  body('browser')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('المتصفح طويل جداً'),
  
  body('os')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('نظام التشغيل طويل جداً'),
  
  body('screen_resolution')
    .optional()
    .matches(/^\d+x\d+$/)
    .withMessage('دقة الشاشة غير صحيحة'),
  
  body('language')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('اللغة غير صحيحة')
];

// Helper function to get client IP
function getClientIP(req) {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         'unknown';
}

// Helper function to parse user agent
function parseUserAgent(userAgent) {
  const ua = userAgent || '';
  
  // Detect device type
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad|android(?!.*mobile)/i.test(ua)) {
    deviceType = 'tablet';
  }

  // Detect browser
  let browser = 'unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Opera')) browser = 'Opera';

  // Detect OS
  let os = 'unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';

  return { deviceType, browser, os };
}

// POST /api/analytics/visit - Track page visit
router.post('/visit', visitValidation, async (req, res) => {
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

    const {
      page_url,
      page_title,
      referrer,
      device_type,
      browser,
      os,
      screen_resolution,
      language,
      session_id
    } = req.body;

    const ipAddress = getClientIP(req);
    const userAgent = req.get('User-Agent') || '';

    // Parse user agent if not provided
    const parsedUA = parseUserAgent(userAgent);
    const finalDeviceType = device_type || parsedUA.deviceType;
    const finalBrowser = browser || parsedUA.browser;
    const finalOS = os || parsedUA.os;

    // Generate session ID if not provided
    const finalSessionId = session_id || uuidv4();

    // Insert visit into database
    const result = await database.run(
      `INSERT INTO website_analytics 
       (page_url, page_title, referrer, ip_address, user_agent, device_type, 
        browser, os, screen_resolution, language, session_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        page_url,
        page_title || null,
        referrer || null,
        ipAddress,
        userAgent,
        finalDeviceType,
        finalBrowser,
        finalOS,
        screen_resolution || null,
        language || 'ar',
        finalSessionId
      ]
    );

    res.status(201).json({
      success: true,
      message: 'تم تسجيل الزيارة بنجاح',
      data: {
        visit_id: result.id,
        session_id: finalSessionId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Track visit error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تسجيل الزيارة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/analytics/visit/:id/duration - Update visit duration
router.put('/visit/:id/duration', async (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body;

    if (!duration || duration < 0) {
      return res.status(400).json({
        success: false,
        message: 'مدة الزيارة غير صحيحة'
      });
    }

    const result = await database.run(
      'UPDATE website_analytics SET visit_duration = ? WHERE id = ?',
      [duration, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'الزيارة غير موجودة'
      });
    }

    res.json({
      success: true,
      message: 'تم تحديث مدة الزيارة بنجاح'
    });

  } catch (error) {
    console.error('Update visit duration error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث مدة الزيارة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/analytics/visits - Get visits data
router.get('/visits', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      date_from, 
      date_to, 
      device_type,
      page_url
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Date range filter
    if (date_from) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(date_to);
    }

    // Device type filter
    if (device_type && device_type !== 'all') {
      whereClause += ' AND device_type = ?';
      params.push(device_type);
    }

    // Page URL filter
    if (page_url) {
      whereClause += ' AND page_url LIKE ?';
      params.push(`%${page_url}%`);
    }

    const visits = await database.query(
      `SELECT id, page_url, page_title, referrer, device_type, browser, os, 
              screen_resolution, language, session_id, visit_duration, created_at
       FROM website_analytics 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalCount = await database.get(
      `SELECT COUNT(*) as count FROM website_analytics ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        visits,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount.count,
          pages: Math.ceil(totalCount.count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get visits error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات الزيارات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/analytics/stats/overview - Get analytics overview
router.get('/stats/overview', async (req, res) => {
  try {
    const { period = '7d' } = req.query;

    let dateFilter = '';
    switch (period) {
      case '1d':
        dateFilter = "AND DATE(created_at) = DATE('now')";
        break;
      case '7d':
        dateFilter = "AND DATE(created_at) >= DATE('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "AND DATE(created_at) >= DATE('now', '-30 days')";
        break;
      case '90d':
        dateFilter = "AND DATE(created_at) >= DATE('now', '-90 days')";
        break;
    }

    const stats = await database.query(`
      SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT ip_address) as unique_visitors,
        AVG(visit_duration) as avg_duration,
        COUNT(DISTINCT page_url) as unique_pages
      FROM website_analytics 
      WHERE 1=1 ${dateFilter}
    `);

    const deviceStats = await database.query(`
      SELECT device_type, COUNT(*) as count
      FROM website_analytics 
      WHERE 1=1 ${dateFilter}
      GROUP BY device_type
      ORDER BY count DESC
    `);

    const browserStats = await database.query(`
      SELECT browser, COUNT(*) as count
      FROM website_analytics 
      WHERE 1=1 ${dateFilter}
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 10
    `);

    const pageStats = await database.query(`
      SELECT page_url, page_title, COUNT(*) as visits
      FROM website_analytics 
      WHERE 1=1 ${dateFilter}
      GROUP BY page_url
      ORDER BY visits DESC
      LIMIT 10
    `);

    const hourlyStats = await database.query(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as visits
      FROM website_analytics 
      WHERE 1=1 ${dateFilter}
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `);

    const dailyStats = await database.query(`
      SELECT DATE(created_at) as date, COUNT(*) as visits
      FROM website_analytics 
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    res.json({
      success: true,
      data: {
        overview: {
          ...stats[0],
          avg_duration: stats[0].avg_duration ? Math.round(stats[0].avg_duration) : 0
        },
        device_breakdown: deviceStats,
        browser_breakdown: browserStats,
        top_pages: pageStats,
        hourly_distribution: hourlyStats,
        daily_trend: dailyStats
      }
    });

  } catch (error) {
    console.error('Get analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إحصائيات الموقع',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/analytics/stats/real-time - Get real-time stats
router.get('/stats/real-time', async (req, res) => {
  try {
    const currentHour = new Date().getHours();
    const currentDate = new Date().toISOString().split('T')[0];

    const stats = await database.query(`
      SELECT 
        COUNT(*) as visits_last_hour,
        COUNT(DISTINCT session_id) as unique_sessions_last_hour,
        COUNT(DISTINCT ip_address) as unique_visitors_last_hour
      FROM website_analytics 
      WHERE strftime('%H', created_at) = ? AND DATE(created_at) = ?
    `, [currentHour.toString().padStart(2, '0'), currentDate]);

    const activeSessions = await database.query(`
      SELECT session_id, MAX(created_at) as last_activity
      FROM website_analytics 
      WHERE datetime(created_at) > datetime('now', '-30 minutes')
      GROUP BY session_id
      ORDER BY last_activity DESC
    `);

    res.json({
      success: true,
      data: {
        current_hour: stats[0],
        active_sessions: activeSessions.length,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get real-time stats error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الإحصائيات المباشرة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/analytics/export - Export analytics data
router.get('/export', async (req, res) => {
  try {
    const { format = 'json', date_from, date_to } = req.query;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (date_from) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(date_to);
    }

    const data = await database.query(
      `SELECT * FROM website_analytics ${whereClause} ORDER BY created_at DESC`,
      params
    );

    if (format === 'csv') {
      // Convert to CSV
      const headers = Object.keys(data[0] || {}).join(',');
      const csvData = data.map(row => 
        Object.values(row).map(val => 
          typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
        ).join(',')
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
      res.send(`${headers}\n${csvData}`);
    } else {
      res.json({
        success: true,
        data: data,
        exported_at: new Date().toISOString(),
        total_records: data.length
      });
    }

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تصدير البيانات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
