const express = require('express');

class UserController {
    constructor(database) {
        this.db = database;
        this.router = express.Router();
        this.setupRoutes();
    }

    setupRoutes() {
        // Get user data
        this.router.get('/:telegram_id', this.getUser.bind(this));
        
        // Create or update user
        this.router.post('/', this.createOrUpdateUser.bind(this));
        
        // Update user crystals
        this.router.put('/:telegram_id/crystals', this.updateCrystals.bind(this));
        
        // Update user city
        this.router.put('/:telegram_id/city', this.updateCity.bind(this));
    }

    async getUser(req, res) {
        try {
            const { telegram_id } = req.params;
            const user = await this.db.getUserByTelegramId(telegram_id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            res.json({
                success: true,
                data: {
                    id: user.id,
                    telegram_id: user.telegram_id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    username: user.username,
                    photo_url: user.photo_url,
                    crystals: user.crystals,
                    last_crystal_time: user.last_crystal_time,
                    last_publication_time: user.last_publication_time,
                    selected_city: user.selected_city,
                    created_at: user.created_at
                }
            });
        } catch (error) {
            console.error('Error getting user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user',
                message: error.message
            });
        }
    }

    async createOrUpdateUser(req, res) {
        try {
            const { 
                telegram_id, 
                first_name, 
                last_name, 
                username, 
                photo_url 
            } = req.body;

            if (!telegram_id || !first_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    required: ['telegram_id', 'first_name']
                });
            }

            const user = await this.db.createOrUpdateUser({
                telegram_id,
                first_name,
                last_name: last_name || '',
                username: username || '',
                photo_url: photo_url || ''
            });

            res.json({
                success: true,
                data: {
                    id: user.id,
                    telegram_id: user.telegram_id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    username: user.username,
                    photo_url: user.photo_url,
                    crystals: user.crystals,
                    last_crystal_time: user.last_crystal_time,
                    last_publication_time: user.last_publication_time,
                    selected_city: user.selected_city,
                    created_at: user.created_at
                },
                message: 'User created/updated successfully'
            });
        } catch (error) {
            console.error('Error creating/updating user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create/update user',
                message: error.message
            });
        }
    }

    async updateCrystals(req, res) {
        try {
            const { telegram_id } = req.params;
            const { crystals, last_crystal_time } = req.body;

            if (crystals === undefined || !last_crystal_time) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    required: ['crystals', 'last_crystal_time']
                });
            }

            const user = await this.db.getUserByTelegramId(telegram_id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Ensure crystals don't exceed maximum (5)
            const maxCrystals = 5;
            const finalCrystals = Math.min(crystals, maxCrystals);

            await this.db.updateUserCrystals(user.id, finalCrystals, last_crystal_time);

            res.json({
                success: true,
                data: {
                    crystals: finalCrystals,
                    last_crystal_time: last_crystal_time
                },
                message: 'Crystals updated successfully'
            });
        } catch (error) {
            console.error('Error updating crystals:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update crystals',
                message: error.message
            });
        }
    }

    async updateCity(req, res) {
        try {
            const { telegram_id } = req.params;
            const { city } = req.body;

            if (!city) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field',
                    required: ['city']
                });
            }

            const user = await this.db.getUserByTelegramId(telegram_id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            await this.db.run(
                'UPDATE users SET selected_city = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [city, user.id]
            );

            res.json({
                success: true,
                data: { selected_city: city },
                message: 'City updated successfully'
            });
        } catch (error) {
            console.error('Error updating city:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update city',
                message: error.message
            });
        }
    }
}

module.exports = UserController;
