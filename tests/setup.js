// Test setup file
const database = require('../config/database');

// Setup test database
beforeAll(async () => {
  // Initialize test database
  database.init();
  
  // Wait for database to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
});

// Clean up after each test
afterEach(async () => {
  // Clean up test data
  try {
    await database.run('DELETE FROM contact_messages WHERE email LIKE "%@example.com"');
    await database.run('DELETE FROM testimonials WHERE email LIKE "%@example.com"');
    await database.run('DELETE FROM website_analytics WHERE page_url LIKE "%test%"');
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Clean up after all tests
afterAll(async () => {
  // Close database connection
  database.close();
});
