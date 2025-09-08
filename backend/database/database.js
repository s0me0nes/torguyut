const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.dbPath = process.env.DATABASE_PATH || './database/bazaar.db';
        this.db = null;
    }

    async init() {
        // Ensure database directory exists
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT,
                username TEXT,
                photo_url TEXT,
                crystals INTEGER DEFAULT 1,
                last_crystal_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_publication_time DATETIME,
                selected_city TEXT DEFAULT 'saratov',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Publications table
            `CREATE TABLE IF NOT EXISTS publications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                city TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                price REAL NOT NULL,
                images TEXT, -- JSON array of image URLs
                telegram_message_id INTEGER, -- ID of message in Telegram channel
                telegram_chat_id TEXT, -- Channel ID where published
                status TEXT DEFAULT 'active', -- active, deleted, expired
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,

            // Views table for tracking publication views
            `CREATE TABLE IF NOT EXISTS publication_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                publication_id INTEGER NOT NULL,
                user_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (publication_id) REFERENCES publications (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,

            // Likes table for publication likes
            `CREATE TABLE IF NOT EXISTS publication_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                publication_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (publication_id) REFERENCES publications (id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(publication_id, user_id)
            )`,

            // Comments table for publication comments
            `CREATE TABLE IF NOT EXISTS publication_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                publication_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                comment_text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (publication_id) REFERENCES publications (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,

            // Create indexes
            `CREATE INDEX IF NOT EXISTS idx_publications_city ON publications(city)`,
            `CREATE INDEX IF NOT EXISTS idx_publications_user ON publications(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_publications_status ON publications(status)`,
            `CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`,
            `CREATE INDEX IF NOT EXISTS idx_views_publication ON publication_views(publication_id)`,
            `CREATE INDEX IF NOT EXISTS idx_likes_publication ON publication_likes(publication_id)`,
            `CREATE INDEX IF NOT EXISTS idx_likes_user ON publication_likes(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_comments_publication ON publication_comments(publication_id)`,
            `CREATE INDEX IF NOT EXISTS idx_comments_user ON publication_comments(user_id)`
        ];

        for (const table of tables) {
            await this.run(table);
        }
    }

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

    all(sql, params = []) {
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

    // User methods
    async createOrUpdateUser(userData) {
        const { telegram_id, first_name, last_name, username, photo_url } = userData;
        
        const existingUser = await this.get(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegram_id]
        );

        if (existingUser) {
            // Update existing user
            await this.run(
                `UPDATE users SET 
                    first_name = ?, last_name = ?, username = ?, photo_url = ?, 
                    updated_at = CURRENT_TIMESTAMP
                 WHERE telegram_id = ?`,
                [first_name, last_name, username, photo_url, telegram_id]
            );
            return existingUser;
        } else {
            // Create new user
            const result = await this.run(
                `INSERT INTO users (telegram_id, first_name, last_name, username, photo_url)
                 VALUES (?, ?, ?, ?, ?)`,
                [telegram_id, first_name, last_name, username, photo_url]
            );
            return { id: result.id, ...userData };
        }
    }

    async getUserByTelegramId(telegramId) {
        return await this.get(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramId]
        );
    }

    async updateUserCrystals(userId, crystals, lastCrystalTime) {
        await this.run(
            'UPDATE users SET crystals = ?, last_crystal_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [crystals, lastCrystalTime, userId]
        );
    }

    async updateUserLastPublication(userId, lastPublicationTime) {
        await this.run(
            'UPDATE users SET last_publication_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [lastPublicationTime, userId]
        );
    }

    // Publication methods
    async createPublication(publicationData) {
        const { user_id, city, title, description, price, images, telegram_message_id, telegram_chat_id } = publicationData;
        
        const result = await this.run(
            `INSERT INTO publications 
             (user_id, city, title, description, price, images, telegram_message_id, telegram_chat_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, city, title, description, price, JSON.stringify(images), telegram_message_id, telegram_chat_id]
        );
        
        return result.id;
    }

    async getPublicationsByCity(city, limit = 50, offset = 0) {
        const publications = await this.all(
            `SELECT p.*, u.first_name, u.last_name, u.username, u.photo_url
             FROM publications p
             JOIN users u ON p.user_id = u.id
             WHERE p.city = ? AND p.status = 'active'
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [city, limit, offset]
        );

        return publications.map(pub => ({
            ...pub,
            images: JSON.parse(pub.images || '[]'),
            author: {
                id: pub.user_id,
                name: `${pub.first_name} ${pub.last_name || ''}`.trim(),
                username: pub.username,
                avatar: pub.photo_url
            }
        }));
    }

    async getPublicationById(id) {
        const publication = await this.get(
            `SELECT p.*, u.first_name, u.last_name, u.username, u.photo_url
             FROM publications p
             JOIN users u ON p.user_id = u.id
             WHERE p.id = ?`,
            [id]
        );

        if (publication) {
            return {
                ...publication,
                images: JSON.parse(publication.images || '[]'),
                author: {
                    id: publication.user_id,
                    name: `${publication.first_name} ${publication.last_name || ''}`.trim(),
                    username: publication.username,
                    avatar: publication.photo_url
                }
            };
        }
        return null;
    }

    async deletePublication(id) {
        await this.run(
            'UPDATE publications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['deleted', id]
        );
    }

    // Views methods
    async addView(publicationId, userId = null, ipAddress = null, userAgent = null) {
        await this.run(
            `INSERT INTO publication_views (publication_id, user_id, ip_address, user_agent)
             VALUES (?, ?, ?, ?)`,
            [publicationId, userId, ipAddress, userAgent]
        );
    }

    async getViewCount(publicationId) {
        const result = await this.get(
            'SELECT COUNT(*) as count FROM publication_views WHERE publication_id = ?',
            [publicationId]
        );
        return result.count;
    }

    // Likes methods
    async toggleLike(publicationId, userId) {
        const existingLike = await this.get(
            'SELECT id FROM publication_likes WHERE publication_id = ? AND user_id = ?',
            [publicationId, userId]
        );

        if (existingLike) {
            // Unlike
            await this.run(
                'DELETE FROM publication_likes WHERE publication_id = ? AND user_id = ?',
                [publicationId, userId]
            );
            return false;
        } else {
            // Like
            await this.run(
                'INSERT INTO publication_likes (publication_id, user_id) VALUES (?, ?)',
                [publicationId, userId]
            );
            return true;
        }
    }

    async getLikeCount(publicationId) {
        const result = await this.get(
            'SELECT COUNT(*) as count FROM publication_likes WHERE publication_id = ?',
            [publicationId]
        );
        return result.count;
    }

    async isLikedByUser(publicationId, userId) {
        const result = await this.get(
            'SELECT id FROM publication_likes WHERE publication_id = ? AND user_id = ?',
            [publicationId, userId]
        );
        return !!result;
    }

    // Comments methods
    async addComment(publicationId, userId, commentText) {
        const result = await this.run(
            'INSERT INTO publication_comments (publication_id, user_id, comment_text) VALUES (?, ?, ?)',
            [publicationId, userId, commentText]
        );
        return result.id;
    }

    async getComments(publicationId) {
        const comments = await this.all(
            `SELECT c.*, u.first_name, u.last_name, u.username, u.photo_url
             FROM publication_comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.publication_id = ?
             ORDER BY c.created_at ASC`,
            [publicationId]
        );

        return comments.map(comment => ({
            ...comment,
            author: {
                id: comment.user_id,
                name: `${comment.first_name} ${comment.last_name || ''}`.trim(),
                username: comment.username,
                avatar: comment.photo_url
            }
        }));
    }

    async getCommentCount(publicationId) {
        const result = await this.get(
            'SELECT COUNT(*) as count FROM publication_comments WHERE publication_id = ?',
            [publicationId]
        );
        return result.count;
    }

    // Enhanced publication methods with stats
    async getPublicationsByCityWithStats(city, limit = 50, offset = 0) {
        const publications = await this.all(
            `SELECT p.*, u.first_name, u.last_name, u.username, u.photo_url,
                    (SELECT COUNT(*) FROM publication_views pv WHERE pv.publication_id = p.id) as view_count,
                    (SELECT COUNT(*) FROM publication_likes pl WHERE pl.publication_id = p.id) as like_count,
                    (SELECT COUNT(*) FROM publication_comments pc WHERE pc.publication_id = p.id) as comment_count
             FROM publications p
             JOIN users u ON p.user_id = u.id
             WHERE p.city = ? AND p.status = 'active'
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [city, limit, offset]
        );

        return publications.map(pub => ({
            ...pub,
            images: JSON.parse(pub.images || '[]'),
            author: {
                id: pub.user_id,
                name: `${pub.first_name} ${pub.last_name || ''}`.trim(),
                username: pub.username,
                avatar: pub.photo_url
            },
            stats: {
                views: pub.view_count,
                likes: pub.like_count,
                comments: pub.comment_count
            }
        }));
    }

    async getPublicationByIdWithStats(id) {
        const publication = await this.get(
            `SELECT p.*, u.first_name, u.last_name, u.username, u.photo_url,
                    (SELECT COUNT(*) FROM publication_views pv WHERE pv.publication_id = p.id) as view_count,
                    (SELECT COUNT(*) FROM publication_likes pl WHERE pl.publication_id = p.id) as like_count,
                    (SELECT COUNT(*) FROM publication_comments pc WHERE pc.publication_id = p.id) as comment_count
             FROM publications p
             JOIN users u ON p.user_id = u.id
             WHERE p.id = ?`,
            [id]
        );

        if (publication) {
            return {
                ...publication,
                images: JSON.parse(publication.images || '[]'),
                author: {
                    id: publication.user_id,
                    name: `${publication.first_name} ${publication.last_name || ''}`.trim(),
                    username: publication.username,
                    avatar: publication.photo_url
                },
                stats: {
                    views: publication.view_count,
                    likes: publication.like_count,
                    comments: publication.comment_count
                }
            };
        }
        return null;
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = Database;
