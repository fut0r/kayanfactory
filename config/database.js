// Backend removed: static-only site. This file is intentionally left blank.
export {};

class Database {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DB_PATH || './database/kayan_factory.db';
  }

  init() {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Database connection error:', err.message);
          throw err;
        }
        console.log('✅ Connected to SQLite database');
        this.createTables();
      });
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  createTables() {
    const tables = [
      // Contact messages table
      `CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        message TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'new',
        response TEXT,
        responded_at DATETIME
      )`,

      // Testimonials table
      `CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        service TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        message TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        approved BOOLEAN DEFAULT 0,
        approved_at DATETIME,
        admin_notes TEXT
      )`,

      // Website analytics table
      `CREATE TABLE IF NOT EXISTS website_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_url TEXT NOT NULL,
        page_title TEXT,
        referrer TEXT,
        ip_address TEXT,
        user_agent TEXT,
        country TEXT,
        city TEXT,
        device_type TEXT,
        browser TEXT,
        os TEXT,
        screen_resolution TEXT,
        language TEXT,
        session_id TEXT,
        visit_duration INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Email logs table
      `CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        related_id INTEGER
      )`,

      // System settings table
      `CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    tables.forEach((sql, index) => {
      this.db.run(sql, (err) => {
        if (err) {
          console.error(`❌ Error creating table ${index + 1}:`, err.message);
        } else {
          console.log(`✅ Table ${index + 1} created/verified successfully`);
        }
      });
    });

    // Insert default settings
    this.insertDefaultSettings();
  }

  insertDefaultSettings() {
    const defaultSettings = [
      ['site_name', 'كيان الخليج للصناعة', 'اسم الموقع'],
      ['site_email', 'info@kayanfactory.com', 'إيميل الموقع'],
      ['site_phone', '+966545666924', 'رقم هاتف الموقع'],
      ['max_testimonials_per_page', '10', 'عدد التقييمات في الصفحة الواحدة'],
      ['auto_approve_testimonials', 'false', 'الموافقة التلقائية على التقييمات'],
      ['email_notifications', 'true', 'إشعارات الإيميل'],
      ['maintenance_mode', 'false', 'وضع الصيانة']
    ];

    const insertSetting = `INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)`;
    
    defaultSettings.forEach(([key, value, description]) => {
      this.db.run(insertSetting, [key, value, description], (err) => {
        if (err) {
          console.error(`❌ Error inserting setting ${key}:`, err.message);
        }
      });
    });
  }

  // Generic query method
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Generic run method for INSERT, UPDATE, DELETE
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // Get single row
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
        } else {
          console.log('✅ Database connection closed');
        }
      });
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const stats = await Promise.all([
        this.get('SELECT COUNT(*) as count FROM contact_messages'),
        this.get('SELECT COUNT(*) as count FROM testimonials'),
        this.get('SELECT COUNT(*) as count FROM website_analytics'),
        this.get('SELECT COUNT(*) as count FROM testimonials WHERE approved = 1'),
        this.get('SELECT COUNT(*) as count FROM contact_messages WHERE status = "new"')
      ]);

      return {
        totalMessages: stats[0].count,
        totalTestimonials: stats[1].count,
        totalVisits: stats[2].count,
        approvedTestimonials: stats[3].count,
        newMessages: stats[4].count
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  }
}

module.exports = new Database();
