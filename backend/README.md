# Backend для Telegram Барахолка MiniApp

Backend сервер для работы с Telegram Bot API и базой данных объявлений.

## Функции

- 🔗 **Интеграция с Telegram Bot API** - публикация объявлений в каналы
- 🗄️ **SQLite база данных** - хранение пользователей и объявлений
- 📸 **Обработка изображений** - оптимизация и загрузка в Telegram
- 🏙️ **Мультигород** - поддержка разных городов с отдельными каналами
- 🔒 **Система кристаллов** - контроль публикаций и антифлуд
- 📱 **REST API** - для работы с frontend

## Установка

### 1. Установка зависимостей
```bash
cd backend
npm install
```

### 2. Настройка окружения
```bash
cp env.example .env
```

Отредактируйте `.env` файл:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook

# Database Configuration
DATABASE_PATH=./database/bazaar.db

# Server Configuration
PORT=3001
NODE_ENV=development

# City Channels Configuration
CITY_CHANNELS={"saratov": "@saratov_bazaar", "moscow": "@moscow_bazaar", "spb": "@spb_bazaar"}

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### 3. Создание Telegram бота

1. Создайте бота через @BotFather
2. Получите токен бота
3. Добавьте токен в `.env` файл
4. Создайте каналы для городов (например, @saratov_bazaar)
5. Добавьте бота в каналы как администратора
6. Обновите `CITY_CHANNELS` в `.env`

### 4. Запуск сервера

```bash
# Разработка
npm run dev

# Продакшен
npm start
```

## API Endpoints

### Пользователи

#### `GET /api/users/:telegram_id`
Получить данные пользователя

#### `POST /api/users`
Создать или обновить пользователя
```json
{
  "telegram_id": 12345,
  "first_name": "Иван",
  "last_name": "Иванов",
  "username": "ivan_user",
  "photo_url": "https://..."
}
```

#### `PUT /api/users/:telegram_id/crystals`
Обновить кристаллы пользователя
```json
{
  "crystals": 3,
  "last_crystal_time": "2024-01-01T12:00:00Z"
}
```

#### `PUT /api/users/:telegram_id/city`
Обновить выбранный город
```json
{
  "city": "saratov"
}
```

### Публикации

#### `GET /api/publications/city/:city`
Получить публикации по городу
```
GET /api/publications/city/saratov?limit=50&offset=0
```

#### `GET /api/publications/:id`
Получить конкретную публикацию

#### `POST /api/publications`
Создать новую публикацию
```javascript
const formData = new FormData();
formData.append('telegram_id', 12345);
formData.append('city', 'saratov');
formData.append('title', 'Продам iPhone');
formData.append('description', 'Отличное состояние');
formData.append('price', 50000);
formData.append('images', file1);
formData.append('images', file2);
```

#### `DELETE /api/publications/:id`
Удалить публикацию
```json
{
  "telegram_id": 12345
}
```

## Структура базы данных

### Таблица `users`
- `id` - Primary key
- `telegram_id` - ID пользователя в Telegram
- `first_name`, `last_name`, `username`, `photo_url` - Данные профиля
- `crystals` - Количество кристаллов
- `last_crystal_time` - Время последнего начисления кристалла
- `last_publication_time` - Время последней публикации
- `selected_city` - Выбранный город

### Таблица `publications`
- `id` - Primary key
- `user_id` - ID пользователя
- `city` - Город публикации
- `title`, `description`, `price` - Данные объявления
- `images` - JSON массив URL изображений
- `telegram_message_id` - ID сообщения в Telegram
- `telegram_chat_id` - ID канала в Telegram
- `status` - Статус (active, deleted, expired)

## Развертывание

### Heroku
1. Создайте приложение на Heroku
2. Добавьте переменные окружения
3. Подключите GitHub репозиторий
4. Включите автоматическое развертывание

### Vercel
1. Установите Vercel CLI: `npm i -g vercel`
2. В папке backend: `vercel`
3. Настройте переменные окружения

### DigitalOcean App Platform
1. Создайте новое приложение
2. Подключите GitHub репозиторий
3. Настройте переменные окружения
4. Укажите команду запуска: `npm start`

### VPS (Ubuntu/Debian)
```bash
# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Клонирование репозитория
git clone your-repo
cd your-repo/backend

# Установка зависимостей
npm install --production

# Установка PM2
sudo npm install -g pm2

# Запуск приложения
pm2 start server.js --name bazaar-backend
pm2 save
pm2 startup
```

## Мониторинг

### Логи
```bash
# PM2 логи
pm2 logs bazaar-backend

# Системные логи
journalctl -u your-app-service
```

### Health Check
```
GET /api/health
```

## Безопасность

- ✅ Валидация входных данных
- ✅ Ограничение размера файлов (10MB)
- ✅ CORS настройки
- ✅ Обработка ошибок
- ⚠️ Добавьте rate limiting для продакшена
- ⚠️ Настройте HTTPS
- ⚠️ Добавьте аутентификацию для админских функций

## Масштабирование

Для высоких нагрузок рассмотрите:
- PostgreSQL вместо SQLite
- Redis для кэширования
- CDN для изображений
- Load balancer
- Микросервисная архитектура

## Поддержка

При возникновении проблем:
1. Проверьте логи сервера
2. Убедитесь в правильности настроек Telegram Bot
3. Проверьте доступность каналов
4. Создайте issue в репозитории
