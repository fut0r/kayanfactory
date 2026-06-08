module.exports = {
  apps: [{
    name: 'kayan-factory-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000
    },
    // PM2 configuration
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Auto restart configuration
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // Advanced PM2 features
    kill_timeout: 5000,
    listen_timeout: 3000,
    wait_ready: true,
    
    // Environment variables
    env_file: '.env',
    
    // Logging
    log_type: 'json',
    merge_logs: true,
    
    // Process management
    min_uptime: '10s',
    max_restarts: 5,
    
    // Cluster mode specific
    instance_var: 'INSTANCE_ID',
    
    // Source map support
    source_map_support: true,
    
    // Advanced features
    increment_var: 'PORT',
    
    // Custom restart conditions
    restart_delay: 4000,
    
    // Memory management
    max_memory_restart: '500M',
    
    // Error handling
    exp_backoff_restart_delay: 100,
    
    // Process title
    process_title: 'kayan-backend'
  }],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/kayan-factory-backend.git',
      path: '/var/www/kayan-factory-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run init-db && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    },
    staging: {
      user: 'deploy',
      host: 'staging-server.com',
      ref: 'origin/develop',
      repo: 'https://github.com/your-username/kayan-factory-backend.git',
      path: '/var/www/kayan-factory-backend-staging',
      'post-deploy': 'npm install && npm run init-db && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};
