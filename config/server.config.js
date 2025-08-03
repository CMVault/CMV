const path = require('path');

module.exports = {
    // Port configuration with fallbacks
    port: process.env.PORT || 3000,
    
    // Alternative ports to try if main port is busy
    alternativePorts: [3001, 3002, 3003, 8080, 8081],
    
    // Database configuration
    database: {
        path: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'camera-vault.db')
    },
    
    // Server configuration
    server: {
        environment: process.env.NODE_ENV || 'development',
        gracefulShutdown: true,
        compression: true
    }
};
