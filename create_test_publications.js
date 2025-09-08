const Database = require('./backend/database/database');

async function createTestPublications() {
    const db = new Database();
    await db.init();

    // Создаем тестового пользователя
    const testUser = await db.createOrUpdateUser({
        telegram_id: 999999,
        first_name: 'Тестовый',
        last_name: 'Пользователь',
        username: 'test_user',
        photo_url: ''
    });

    console.log('Создан тестовый пользователь:', testUser);

    // Тестовые объявления
    const testPublications = [
        {
            user_id: testUser.id,
            city: 'saratov',
            title: 'iPhone 13 Pro Max 256GB',
            description: 'Продаю iPhone 13 Pro Max в отличном состоянии. Все работает идеально, батарея держит хорошо. В комплекте зарядка и чехол. Цена договорная.',
            price: 75000,
            images: JSON.stringify(['https://via.placeholder.com/300x300/007AFF/FFFFFF?text=iPhone+13+Pro+Max'])
        },
        {
            user_id: testUser.id,
            city: 'saratov',
            title: 'MacBook Air M1 2020',
            description: 'MacBook Air с чипом M1, 8GB RAM, 256GB SSD. В отличном состоянии, без царапин. Идеально подходит для работы и учебы.',
            price: 85000,
            images: JSON.stringify(['https://via.placeholder.com/300x300/34C759/FFFFFF?text=MacBook+Air+M1'])
        },
        {
            user_id: testUser.id,
            city: 'saratov',
            title: 'Sony PlayStation 5',
            description: 'PS5 в отличном состоянии, играл аккуратно. В комплекте 2 джойстика и несколько игр. Консоль работает без нареканий.',
            price: 45000,
            images: JSON.stringify(['https://via.placeholder.com/300x300/003791/FFFFFF?text=PlayStation+5'])
        },
        {
            user_id: testUser.id,
            city: 'saratov',
            title: 'Nike Air Jordan 1',
            description: 'Кроссовки Nike Air Jordan 1, размер 42. Носил пару раз, состояние отличное. Оригинал, есть чек.',
            price: 12000,
            images: JSON.stringify(['https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=Air+Jordan+1'])
        },
        {
            user_id: testUser.id,
            city: 'saratov',
            title: 'Велосипед горный Trek',
            description: 'Горный велосипед Trek в хорошем состоянии. Все механизмы работают, тормоза исправны. Подходит для прогулок и спорта.',
            price: 25000,
            images: JSON.stringify(['https://via.placeholder.com/300x300/FFD700/000000?text=Trek+Bike'])
        }
    ];

    console.log('Создаем тестовые объявления...');

    for (let i = 0; i < testPublications.length; i++) {
        const pub = testPublications[i];
        try {
            const publicationId = await db.createPublication({
                user_id: pub.user_id,
                city: pub.city,
                title: pub.title,
                description: pub.description,
                price: pub.price,
                images: JSON.parse(pub.images),
                telegram_message_id: null,
                telegram_chat_id: null
            });

            // Добавляем несколько просмотров для реалистичности
            const viewCount = Math.floor(Math.random() * 50) + 10;
            for (let j = 0; j < viewCount; j++) {
                await db.addView(publicationId, null, `192.168.1.${j % 255}`, 'Test Browser');
            }

            // Добавляем несколько лайков
            const likeCount = Math.floor(Math.random() * 20) + 1;
            for (let j = 0; j < likeCount; j++) {
                const randomUserId = Math.floor(Math.random() * 10) + 1;
                try {
                    await db.toggleLike(publicationId, randomUserId);
                } catch (e) {
                    // Игнорируем ошибки дублирования лайков
                }
            }

            // Добавляем несколько комментариев
            const comments = [
                'Интересное предложение!',
                'Можно ли торг?',
                'В каком районе?',
                'Есть ли гарантия?',
                'Очень заинтересован!',
                'Можно посмотреть?',
                'Отличная цена!',
                'Когда можно забрать?'
            ];

            const commentCount = Math.floor(Math.random() * 5) + 1;
            for (let j = 0; j < commentCount; j++) {
                const randomUserId = Math.floor(Math.random() * 10) + 1;
                const randomComment = comments[Math.floor(Math.random() * comments.length)];
                try {
                    await db.addComment(publicationId, randomUserId, randomComment);
                } catch (e) {
                    // Игнорируем ошибки
                }
            }

            console.log(`Создано объявление ${i + 1}: ${pub.title} (ID: ${publicationId})`);
        } catch (error) {
            console.error(`Ошибка при создании объявления ${i + 1}:`, error);
        }
    }

    console.log('Тестовые объявления созданы успешно!');
    await db.close();
}

createTestPublications().catch(console.error);
