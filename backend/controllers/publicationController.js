const express = require('express');
const multer = require('multer');

class PublicationController {
    constructor(database, telegramService) {
        this.db = database;
        this.telegram = telegramService;
        this.router = express.Router();
        
        // Configure multer for memory storage
        this.upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB limit
                files: 5 // Max 5 files
            },
            fileFilter: (req, file, cb) => {
                if (file.mimetype.startsWith('image/')) {
                    cb(null, true);
                } else {
                    cb(new Error('Only image files are allowed'), false);
                }
            }
        });

        this.setupRoutes();
    }

    setupRoutes() {
        // Get publications by city
        this.router.get('/city/:city', this.getPublicationsByCity.bind(this));
        
        // Get single publication
        this.router.get('/:id', this.getPublicationById.bind(this));
        
        // Create new publication
        this.router.post('/', this.upload.array('images', 5), this.createPublication.bind(this));
        
        // Delete publication
        this.router.delete('/:id', this.deletePublication.bind(this));
        
        // Like/unlike publication
        this.router.post('/:id/like', this.toggleLike.bind(this));
        
        // Add comment to publication
        this.router.post('/:id/comment', this.addComment.bind(this));
        
        // Get comments for publication
        this.router.get('/:id/comments', this.getComments.bind(this));
        
        // Track view
        this.router.post('/:id/view', this.trackView.bind(this));
    }

    async getPublicationsByCity(req, res) {
        try {
            const { city } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const publications = await this.db.getPublicationsByCityWithStats(
                city, 
                parseInt(limit), 
                parseInt(offset)
            );

            res.json({
                success: true,
                data: publications,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    count: publications.length
                }
            });
        } catch (error) {
            console.error('Error getting publications:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get publications',
                message: error.message
            });
        }
    }

    async getPublicationById(req, res) {
        try {
            const { id } = req.params;
            const publication = await this.db.getPublicationByIdWithStats(id);

            if (!publication) {
                return res.status(404).json({
                    success: false,
                    error: 'Publication not found'
                });
            }

            res.json({
                success: true,
                data: publication
            });
        } catch (error) {
            console.error('Error getting publication:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get publication',
                message: error.message
            });
        }
    }

    async createPublication(req, res) {
        try {
            const { 
                telegram_id, 
                city, 
                title, 
                description, 
                price 
            } = req.body;

            const files = req.files || [];

            // Validate required fields
            if (!telegram_id || !city || !title || !description || !price) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    required: ['telegram_id', 'city', 'title', 'description', 'price']
                });
            }

            // Get or create user
            let user = await this.db.getUserByTelegramId(telegram_id);
            if (!user) {
                // Create user with default data (will be updated by frontend)
                user = await this.db.createOrUpdateUser({
                    telegram_id,
                    first_name: 'Пользователь',
                    last_name: '',
                    username: '',
                    photo_url: ''
                });
            }

            // Check if user has enough crystals
            if (user.crystals < 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient crystals',
                    message: 'You need at least 1 crystal to publish'
                });
            }

            // Check anti-flood (1 minute between publications)
            const now = new Date();
            if (user.last_publication_time) {
                const timeDiff = now - new Date(user.last_publication_time);
                if (timeDiff < 60 * 1000) { // 1 minute
                    const remainingTime = Math.ceil((60 * 1000 - timeDiff) / 1000);
                    return res.status(400).json({
                        success: false,
                        error: 'Anti-flood protection',
                        message: `Please wait ${remainingTime} seconds before next publication`
                    });
                }
            }

            // Process images
            let imageUrls = [];
            let telegramMessageId = null;
            let telegramChatId = null;

            if (files.length > 0) {
                try {
                    // Convert files to buffers
                    const imageBuffers = files.map(file => file.buffer);
                    
                    // Create publication caption
                    const publication = {
                        title,
                        description,
                        price: parseFloat(price),
                        author: {
                            name: `${user.first_name} ${user.last_name || ''}`.trim(),
                            username: user.username
                        }
                    };
                    
                    const caption = this.telegram.formatPublicationCaption(publication);

                    // Send to Telegram channel
                    let telegramResult;
                    if (files.length === 1) {
                        telegramResult = await this.telegram.sendPhotoToChannel(
                            city, 
                            imageBuffers[0], 
                            caption
                        );
                    } else {
                        telegramResult = await this.telegram.sendMediaGroupToChannel(
                            city, 
                            imageBuffers, 
                            caption
                        );
                    }

                    telegramMessageId = telegramResult.messageId;
                    telegramChatId = telegramResult.chatId;

                    // For now, we'll store the message ID as image URL
                    // In a real app, you might want to extract actual image URLs
                    imageUrls = [`telegram_message_${telegramMessageId}`];

                } catch (telegramError) {
                    console.error('Error sending to Telegram:', telegramError);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to publish to Telegram',
                        message: telegramError.message
                    });
                }
            }

            // Create publication in database
            const publicationId = await this.db.createPublication({
                user_id: user.id,
                city,
                title,
                description,
                price: parseFloat(price),
                images: imageUrls,
                telegram_message_id: telegramMessageId,
                telegram_chat_id: telegramChatId
            });

            // Deduct crystal and update user
            await this.db.updateUserCrystals(user.id, user.crystals - 1, user.last_crystal_time);
            await this.db.updateUserLastPublication(user.id, now);

            // Get the created publication
            const createdPublication = await this.db.getPublicationById(publicationId);

            res.json({
                success: true,
                data: createdPublication,
                message: 'Publication created successfully'
            });

        } catch (error) {
            console.error('Error creating publication:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create publication',
                message: error.message
            });
        }
    }

    async deletePublication(req, res) {
        try {
            const { id } = req.params;
            const { telegram_id } = req.body;

            // Get publication
            const publication = await this.db.getPublicationById(id);
            if (!publication) {
                return res.status(404).json({
                    success: false,
                    error: 'Publication not found'
                });
            }

            // Check if user owns the publication
            const user = await this.db.getUserByTelegramId(telegram_id);
            if (!user || publication.user_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    message: 'You can only delete your own publications'
                });
            }

            // Delete from Telegram channel if possible
            if (publication.telegram_message_id && publication.telegram_chat_id) {
                try {
                    await this.telegram.deleteMessage(
                        publication.telegram_chat_id, 
                        publication.telegram_message_id
                    );
                } catch (telegramError) {
                    console.error('Error deleting from Telegram:', telegramError);
                    // Continue with database deletion even if Telegram deletion fails
                }
            }

            // Mark as deleted in database
            await this.db.deletePublication(id);

            res.json({
                success: true,
                message: 'Publication deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting publication:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete publication',
                message: error.message
            });
        }
    }

    async toggleLike(req, res) {
        try {
            const { id } = req.params;
            const { telegram_id } = req.body;

            if (!telegram_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Telegram ID is required'
                });
            }

            // Get user
            const user = await this.db.getUserByTelegramId(telegram_id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Check if publication exists
            const publication = await this.db.getPublicationById(id);
            if (!publication) {
                return res.status(404).json({
                    success: false,
                    error: 'Publication not found'
                });
            }

            // Toggle like
            const isLiked = await this.db.toggleLike(id, user.id);
            const likeCount = await this.db.getLikeCount(id);

            res.json({
                success: true,
                data: {
                    isLiked,
                    likeCount
                }
            });
        } catch (error) {
            console.error('Error toggling like:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to toggle like',
                message: error.message
            });
        }
    }

    async addComment(req, res) {
        try {
            const { id } = req.params;
            const { telegram_id, comment_text } = req.body;

            if (!telegram_id || !comment_text) {
                return res.status(400).json({
                    success: false,
                    error: 'Telegram ID and comment text are required'
                });
            }

            // Get user
            const user = await this.db.getUserByTelegramId(telegram_id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Check if publication exists
            const publication = await this.db.getPublicationById(id);
            if (!publication) {
                return res.status(404).json({
                    success: false,
                    error: 'Publication not found'
                });
            }

            // Add comment
            const commentId = await this.db.addComment(id, user.id, comment_text);
            const comments = await this.db.getComments(id);

            res.json({
                success: true,
                data: {
                    commentId,
                    comments
                }
            });
        } catch (error) {
            console.error('Error adding comment:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to add comment',
                message: error.message
            });
        }
    }

    async getComments(req, res) {
        try {
            const { id } = req.params;
            const comments = await this.db.getComments(id);

            res.json({
                success: true,
                data: comments
            });
        } catch (error) {
            console.error('Error getting comments:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get comments',
                message: error.message
            });
        }
    }

    async trackView(req, res) {
        try {
            const { id } = req.params;
            const { telegram_id } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent');

            // Get user if telegram_id provided
            let userId = null;
            if (telegram_id) {
                const user = await this.db.getUserByTelegramId(telegram_id);
                if (user) {
                    userId = user.id;
                }
            }

            // Add view
            await this.db.addView(id, userId, ipAddress, userAgent);
            const viewCount = await this.db.getViewCount(id);

            res.json({
                success: true,
                data: {
                    viewCount
                }
            });
        } catch (error) {
            console.error('Error tracking view:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to track view',
                message: error.message
            });
        }
    }
}

module.exports = PublicationController;
