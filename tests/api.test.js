const request = require('supertest');
const app = require('../server');

describe('Kayan Factory API Tests', () => {
  
  // Test data
  const testContactMessage = {
    name: 'أحمد محمد',
    email: 'ahmed@example.com',
    phone: '+966501234567',
    message: 'أريد استشارة حول الكرتن وول'
  };

  const testTestimonial = {
    name: 'فاطمة السعيد',
    email: 'fatima@example.com',
    service: 'curtain-wall',
    rating: 5,
    message: 'خدمة ممتازة وجودة عالية'
  };

  const testAnalytics = {
  page_url: 'https://kayanalkhalij1.github.io/Kayan-Al-Khalij11/',
    page_title: 'كيان الخليج للصناعة',
    device_type: 'desktop',
    browser: 'Chrome',
    os: 'Windows',
    screen_resolution: '1920x1080',
    language: 'ar'
  };

  describe('Health Check', () => {
    test('GET /api/health should return 200', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Contact Messages', () => {
    test('POST /api/contact should create a new message', async () => {
      const response = await request(app)
        .post('/api/contact')
        .send(testContactMessage)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('تم إرسال رسالتك بنجاح');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('timestamp');
    });

    test('POST /api/contact should validate required fields', async () => {
      const invalidMessage = {
        name: 'أ',
        email: 'invalid-email',
        message: 'short'
      };

      const response = await request(app)
        .post('/api/contact')
        .send(invalidMessage)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('بيانات غير صحيحة');
      expect(response.body.errors).toBeInstanceOf(Array);
    });

    test('GET /api/contact should return messages', async () => {
      const response = await request(app)
        .get('/api/contact?page=1&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data).toHaveProperty('pagination');
    });

    test('GET /api/contact/stats/summary should return statistics', async () => {
      const response = await request(app)
        .get('/api/contact/stats/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('new_messages');
    });
  });

  describe('Testimonials', () => {
    test('POST /api/testimonials should create a new testimonial', async () => {
      const response = await request(app)
        .post('/api/testimonials')
        .send(testTestimonial)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('تم إرسال تقييمك بنجاح');
      expect(response.body.data).toHaveProperty('id');
    });

    test('POST /api/testimonials should validate rating range', async () => {
      const invalidTestimonial = {
        ...testTestimonial,
        rating: 6
      };

      const response = await request(app)
        .post('/api/testimonials')
        .send(invalidTestimonial)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('GET /api/testimonials/public should return approved testimonials', async () => {
      const response = await request(app)
        .get('/api/testimonials/public?limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('GET /api/testimonials/stats/summary should return statistics', async () => {
      const response = await request(app)
        .get('/api/testimonials/stats/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('average_rating');
    });
  });

  describe('Analytics', () => {
    test('POST /api/analytics/visit should track a visit', async () => {
      const response = await request(app)
        .post('/api/analytics/visit')
        .send(testAnalytics)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('تم تسجيل الزيارة بنجاح');
      expect(response.body.data).toHaveProperty('visit_id');
      expect(response.body.data).toHaveProperty('session_id');
    });

    test('GET /api/analytics/stats/overview should return analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/stats/overview?period=7d')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('device_breakdown');
    });

    test('GET /api/analytics/stats/real-time should return real-time stats', async () => {
      const response = await request(app)
        .get('/api/analytics/stats/real-time')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('current_hour');
      expect(response.body.data).toHaveProperty('active_sessions');
    });
  });

  describe('Error Handling', () => {
    test('GET /api/nonexistent should return 404', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
    });

    test('POST /api/contact with missing fields should return 400', async () => {
      const response = await request(app)
        .post('/api/contact')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('CORS', () => {
    test('OPTIONS request should return CORS headers', async () => {
      const response = await request(app)
        .options('/api/contact')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Rate Limiting', () => {
    test('Multiple requests should be rate limited', async () => {
      const requests = Array(10).fill().map(() => 
        request(app)
          .post('/api/contact')
          .send(testContactMessage)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
