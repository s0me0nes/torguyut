const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');

class TelegramService {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
        this.cityChannels = JSON.parse(process.env.CITY_CHANNELS || '{"saratov": "@saratov_bazaar"}');
    }

    async init() {
        if (!this.botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN is required');
        }
        
        // Test bot connection
        try {
            const response = await axios.get(`${this.baseUrl}/getMe`);
            console.log(`✅ Bot connected: @${response.data.result.username}`);
        } catch (error) {
            throw new Error(`Failed to connect to Telegram Bot: ${error.message}`);
        }
    }

    async sendPhotoToChannel(city, photoBuffer, caption, options = {}) {
        const channelId = this.cityChannels[city];
        if (!channelId) {
            throw new Error(`Channel not found for city: ${city}`);
        }

        try {
            // Optimize image with sharp
            const optimizedBuffer = await sharp(photoBuffer)
                .resize(1200, 1200, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .jpeg({ quality: 85 })
                .toBuffer();

            const formData = new FormData();
            formData.append('photo', optimizedBuffer, {
                filename: 'publication.jpg',
                contentType: 'image/jpeg'
            });
            formData.append('chat_id', channelId);
            formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');

            if (options.disableNotification) {
                formData.append('disable_notification', 'true');
            }

            const response = await axios.post(
                `${this.baseUrl}/sendPhoto`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            return {
                messageId: response.data.result.message_id,
                chatId: response.data.result.chat.id
            };
        } catch (error) {
            console.error('Error sending photo to channel:', error.response?.data || error.message);
            throw new Error(`Failed to send photo to channel: ${error.message}`);
        }
    }

    async sendMediaGroupToChannel(city, media, caption) {
        const channelId = this.cityChannels[city];
        if (!channelId) {
            throw new Error(`Channel not found for city: ${city}`);
        }

        try {
            const mediaGroup = [];
            
            for (let i = 0; i < media.length; i++) {
                const photoBuffer = media[i];
                const optimizedBuffer = await sharp(photoBuffer)
                    .resize(1200, 1200, { 
                        fit: 'inside',
                        withoutEnlargement: true 
                    })
                    .jpeg({ quality: 85 })
                    .toBuffer();

                mediaGroup.push({
                    type: 'photo',
                    media: `attach://photo_${i}`,
                    caption: i === 0 ? caption : undefined
                });
            }

            const formData = new FormData();
            formData.append('chat_id', channelId);
            formData.append('media', JSON.stringify(mediaGroup));
            
            // Add photos to form data
            for (let i = 0; i < media.length; i++) {
                formData.append(`photo_${i}`, media[i], {
                    filename: `photo_${i}.jpg`,
                    contentType: 'image/jpeg'
                });
            }

            const response = await axios.post(
                `${this.baseUrl}/sendMediaGroup`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            return {
                messageId: response.data.result[0].message_id,
                chatId: response.data.result[0].chat.id
            };
        } catch (error) {
            console.error('Error sending media group to channel:', error.response?.data || error.message);
            throw new Error(`Failed to send media group to channel: ${error.message}`);
        }
    }

    async deleteMessage(chatId, messageId) {
        try {
            await axios.post(`${this.baseUrl}/deleteMessage`, {
                chat_id: chatId,
                message_id: messageId
            });
        } catch (error) {
            console.error('Error deleting message:', error.response?.data || error.message);
            throw new Error(`Failed to delete message: ${error.message}`);
        }
    }

    async getChannelInfo(city) {
        const channelId = this.cityChannels[city];
        if (!channelId) {
            throw new Error(`Channel not found for city: ${city}`);
        }

        try {
            const response = await axios.get(`${this.baseUrl}/getChat`, {
                params: { chat_id: channelId }
            });
            return response.data.result;
        } catch (error) {
            console.error('Error getting channel info:', error.response?.data || error.message);
            throw new Error(`Failed to get channel info: ${error.message}`);
        }
    }

    formatPublicationCaption(publication) {
        const { title, description, price, author } = publication;
        
        let caption = `🏷️ <b>${this.escapeHtml(title)}</b>\n\n`;
        caption += `📝 ${this.escapeHtml(description)}\n\n`;
        caption += `💰 <b>${price} ₽</b>\n\n`;
        caption += `👤 ${this.escapeHtml(author.name)}`;
        
        if (author.username) {
            caption += ` (@${author.username})`;
        }
        
        return caption;
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

module.exports = TelegramService;
