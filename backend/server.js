const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Database = require('./database/database');
const TelegramService = require('./services/telegramService');
const PublicationController = require('./controllers/publicationController');
const UserController = require('./controllers/userController');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../')));

// Initialize services
const db = new Database();
const telegramService = new TelegramService();
const publicationController = new PublicationController(db, telegramService);
const userController = new UserController(db);

// API Routes
app.use('/api/publications', publicationController.router);
app.use('/api/users', userController.router);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Webhook for Telegram updates (optional)
app.post('/webhook', (req, res) => {
    console.log('Webhook received:', req.body);
    res.status(200).send('OK');
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start server
async function startServer() {
    try {
        // Initialize database
        await db.init();
        console.log('✅ Database initialized');
        
        // Initialize Telegram service
        await telegramService.init();
        console.log('✅ Telegram service initialized');
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 Frontend: http://localhost:${PORT}`);
            console.log(`🔗 API: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
