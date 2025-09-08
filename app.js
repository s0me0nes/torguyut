class BazaarApp {
    constructor() {
        this.telegram = window.Telegram.WebApp;
        this.user = null;
        this.crystals = 0;
        this.lastCrystalTime = null;
        this.lastPublicationTime = null;
        this.publications = [];
        this.crystalTimer = null;
        this.antifloodTimer = null;
        this.isFirstVisit = false;
        this.selectedCity = null;
        this.MAX_CRYSTALS = 5; // Максимальное количество кристаллов
        this.API_BASE = window.location.origin + '/api';
        this.cities = {
            'saratov': {
                name: 'Саратов',
                region: 'Саратовская область',
                icon: '🏛️',
                available: true,
                chatId: '@saratov_bazaar' // В будущем будет реальный ID чата
            },
            'moscow': {
                name: 'Москва',
                region: 'Московская область',
                icon: '🏢',
                available: false,
                chatId: '@moscow_bazaar'
            },
            'spb': {
                name: 'Санкт-Петербург',
                region: 'Ленинградская область',
                icon: '🌊',
                available: false,
                chatId: '@spb_bazaar'
            }
        };
        
        this.init();
    }

    async init() {
        try {
            // Инициализация Telegram WebApp
            this.telegram.ready();
            this.telegram.expand();
            
            // Получение данных пользователя
            await this.loadUserData();
            
            // Загрузка данных приложения
            await this.loadAppData();
            
            // Инициализация таймеров
            this.initTimers();
            
            // Настройка обработчиков событий
            this.setupEventListeners();
            
            // Показ экранов в зависимости от состояния
            if (this.isFirstVisit) {
                this.showWelcomeScreen();
            } else if (!this.selectedCity) {
                this.showCitySelection();
            } else {
                this.showMainApp();
            }
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.showError('Ошибка загрузки приложения');
        }
    }

    async loadUserData() {
        // Получение данных пользователя из Telegram
        const initData = this.telegram.initDataUnsafe;
        
        if (initData.user) {
            this.user = {
                id: initData.user.id,
                firstName: initData.user.first_name,
                lastName: initData.user.last_name || '',
                username: initData.user.username || '',
                photoUrl: initData.user.photo_url || ''
            };
        } else {
            // Fallback для тестирования
            this.user = {
                id: 12345,
                firstName: 'Тестовый',
                lastName: 'Пользователь',
                username: 'test_user',
                photoUrl: ''
            };
        }

        // Синхронизируем пользователя с сервером
        await this.syncUserWithServer();
    }

    async syncUserWithServer() {
        try {
            const response = await fetch(`${this.API_BASE}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_id: this.user.id,
                    first_name: this.user.firstName,
                    last_name: this.user.lastName,
                    username: this.user.username,
                    photo_url: this.user.photoUrl
                })
            });

            const result = await response.json();
            if (result.success) {
                // Обновляем данные пользователя с сервера
                this.crystals = result.data.crystals;
                this.lastCrystalTime = new Date(result.data.last_crystal_time);
                this.lastPublicationTime = result.data.last_publication_time ? 
                    new Date(result.data.last_publication_time) : null;
                this.selectedCity = result.data.selected_city;
            }
        } catch (error) {
            console.error('Error syncing user with server:', error);
            // Fallback to local data
        }
    }

    async loadAppData() {
        try {
            // Загружаем публикации с сервера
            await this.loadPublicationsFromServer();
            
            // Проверяем, первый ли это визит
            const savedData = localStorage.getItem('bazaar_app_data');
            this.isFirstVisit = !savedData;
            
            if (this.isFirstVisit) {
                this.saveAppData();
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }

    async loadPublicationsFromServer() {
        try {
            if (!this.selectedCity) return;
            
            const response = await fetch(`${this.API_BASE}/publications/city/${this.selectedCity}`);
            const result = await response.json();
            
            if (result.success) {
                this.publications = result.data;
            }
        } catch (error) {
            console.error('Error loading publications from server:', error);
            // Fallback to empty array
            this.publications = [];
        }
    }

    saveAppData() {
        const data = {
            crystals: this.crystals,
            lastCrystalTime: this.lastCrystalTime.toISOString(),
            lastPublicationTime: this.lastPublicationTime ? this.lastPublicationTime.toISOString() : null,
            publications: this.publications,
            selectedCity: this.selectedCity
        };
        localStorage.setItem('bazaar_app_data', JSON.stringify(data));
    }

    initTimers() {
        // Таймер для кристаллов (каждый час)
        this.crystalTimer = setInterval(() => {
            this.addCrystal();
        }, 60 * 60 * 1000); // 1 час в миллисекундах

        // Проверка накопленных кристаллов при запуске
        this.checkAccumulatedCrystals();
    }

    checkAccumulatedCrystals() {
        const now = new Date();
        const timeDiff = now - this.lastCrystalTime;
        const hoursPassed = Math.floor(timeDiff / (60 * 60 * 1000));
        
        if (hoursPassed > 0) {
            // Начисляем кристаллы с учетом лимита
            const newCrystals = Math.min(this.crystals + hoursPassed, this.MAX_CRYSTALS);
            const crystalsAdded = newCrystals - this.crystals;
            
            if (crystalsAdded > 0) {
                this.crystals = newCrystals;
                this.lastCrystalTime = new Date(now.getTime() - (timeDiff % (60 * 60 * 1000)));
                this.saveAppData();
                this.updateUI();
                
                // Показываем уведомление о начисленных кристаллах
                if (crystalsAdded === 1) {
                    this.telegram.showAlert('Получен новый кристалл! 💎');
                } else {
                    this.telegram.showAlert(`Получено ${crystalsAdded} кристаллов! 💎`);
                }
            } else if (this.crystals >= this.MAX_CRYSTALS) {
                // Обновляем время последнего начисления, если достигнут лимит
                this.lastCrystalTime = new Date(now.getTime() - (timeDiff % (60 * 60 * 1000)));
                this.saveAppData();
            }
        }
    }

    addCrystal() {
        if (this.crystals < this.MAX_CRYSTALS) {
            this.crystals++;
            this.lastCrystalTime = new Date();
            this.saveAppData();
            this.updateUI();
            
            // Показываем уведомление
            this.telegram.showAlert('Получен новый кристалл! 💎');
        }
        // Если достигнут лимит, просто обновляем время без начисления
        else {
            this.lastCrystalTime = new Date();
            this.saveAppData();
        }
    }

    setupEventListeners() {
        // Обработчики приветственного экрана
        document.getElementById('start-app-btn').addEventListener('click', () => {
            this.hideWelcomeScreen();
            this.showCitySelection();
        });

        document.getElementById('back-to-welcome-btn').addEventListener('click', () => {
            this.hideCitySelection();
            this.showWelcomeScreen();
        });

        document.getElementById('show-info-btn').addEventListener('click', () => {
            this.showInfoModal();
        });

        document.getElementById('header-info-btn').addEventListener('click', () => {
            this.showInfoModal();
        });

        // Обработчики модального окна
        document.getElementById('close-info-btn').addEventListener('click', () => {
            this.hideInfoModal();
        });

        document.getElementById('close-info-modal-btn').addEventListener('click', () => {
            this.hideInfoModal();
        });

        // Закрытие модального окна по клику вне его
        document.getElementById('info-modal').addEventListener('click', (e) => {
            if (e.target.id === 'info-modal') {
                this.hideInfoModal();
            }
        });

        // Обработчик кнопки публикации
        document.getElementById('publish-btn').addEventListener('click', () => {
            this.handlePublication();
        });

        // Обработчик загрузки изображений
        document.getElementById('item-images').addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        // Обработчики выбора города
        document.querySelectorAll('.city-item').forEach(item => {
            item.addEventListener('click', () => {
                const cityId = item.dataset.city;
                this.selectCity(cityId);
            });
        });

        // Обработчики полей формы
        ['item-title', 'item-description', 'item-price'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.validateForm();
            });
        });
    }

    handleImageUpload(event) {
        const files = Array.from(event.target.files);
        const preview = document.getElementById('image-preview');
        preview.innerHTML = '';

        files.slice(0, 5).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = 'Preview';
                    preview.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });

        this.validateForm();
    }

    validateForm() {
        const title = document.getElementById('item-title').value.trim();
        const description = document.getElementById('item-description').value.trim();
        const price = document.getElementById('item-price').value;
        const images = document.getElementById('item-images').files.length;
        
        const isValid = title && description && price && !isNaN(price) && parseFloat(price) >= 0;
        const hasCrystals = this.crystals > 0;
        const canPublish = this.canPublish();
        
        const btn = document.getElementById('publish-btn');
        btn.disabled = !isValid || !hasCrystals || !canPublish;
        
        if (!hasCrystals) {
            btn.querySelector('.btn-text').textContent = 'Недостаточно кристаллов';
        } else if (!canPublish) {
            const timeLeft = this.getAntifloodTimeLeft();
            btn.querySelector('.btn-text').textContent = `Следующая публикация через: ${timeLeft}`;
        } else {
            btn.querySelector('.btn-text').textContent = 'Опубликовать за 1 💎';
        }
    }

    canPublish() {
        if (!this.lastPublicationTime) return true;
        
        const now = new Date();
        const timeDiff = now - this.lastPublicationTime;
        return timeDiff >= 60 * 1000; // 1 минута
    }

    getAntifloodTimeLeft() {
        if (!this.lastPublicationTime) return '0:00';
        
        const now = new Date();
        const timeDiff = now - this.lastPublicationTime;
        const secondsLeft = Math.max(0, 60 - Math.floor(timeDiff / 1000));
        
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async handlePublication() {
        if (!this.canPublish() || this.crystals < 1) {
            return;
        }

        const title = document.getElementById('item-title').value.trim();
        const description = document.getElementById('item-description').value.trim();
        const price = parseFloat(document.getElementById('item-price').value);
        const images = Array.from(document.getElementById('item-images').files);

        // Показываем индикатор загрузки
        const btn = document.getElementById('publish-btn');
        const originalText = btn.querySelector('.btn-text').textContent;
        btn.querySelector('.btn-text').textContent = 'Публикуем...';
        btn.disabled = true;

        try {
            // Создаем FormData для отправки файлов
            const formData = new FormData();
            formData.append('telegram_id', this.user.id);
            formData.append('city', this.selectedCity);
            formData.append('title', title);
            formData.append('description', description);
            formData.append('price', price);
            
            // Добавляем изображения
            images.forEach((file, index) => {
                formData.append('images', file);
            });

            // Отправляем на сервер
            const response = await fetch(`${this.API_BASE}/publications`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                // Добавляем в локальный список
                this.publications.unshift(result.data);
                
                // Обновляем данные пользователя
                this.crystals = result.data.author.crystals || this.crystals - 1;
                this.lastPublicationTime = new Date();
                
                // Синхронизируем с сервером
                await this.syncUserWithServer();
                
                // Обновление UI
                this.updateUI();
                this.clearForm();
                
                // Показываем уведомление
                this.telegram.showAlert('Объявление опубликовано!');
                
                // Запуск антифлуд таймера
                this.startAntifloodTimer();
            } else {
                throw new Error(result.message || 'Ошибка публикации');
            }
        } catch (error) {
            console.error('Error publishing:', error);
            this.telegram.showAlert(`Ошибка: ${error.message}`);
        } finally {
            // Восстанавливаем кнопку
            btn.querySelector('.btn-text').textContent = originalText;
            btn.disabled = false;
            this.validateForm();
        }
    }

    async processImages(files) {
        const processedImages = [];
        
        for (const file of files.slice(0, 5)) {
            if (file.type.startsWith('image/')) {
                const base64 = await this.fileToBase64(file);
                processedImages.push({
                    name: file.name,
                    data: base64,
                    type: file.type
                });
            }
        }
        
        return processedImages;
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    startAntifloodTimer() {
        if (this.antifloodTimer) {
            clearInterval(this.antifloodTimer);
        }
        
        this.antifloodTimer = setInterval(() => {
            this.validateForm();
            if (this.canPublish()) {
                clearInterval(this.antifloodTimer);
                this.antifloodTimer = null;
            }
        }, 1000);
    }

    clearForm() {
        document.getElementById('item-title').value = '';
        document.getElementById('item-description').value = '';
        document.getElementById('item-price').value = '';
        document.getElementById('item-images').value = '';
        document.getElementById('image-preview').innerHTML = '';
        this.validateForm();
    }

    updateUI() {
        this.updateUserInfo();
        this.updateCrystalInfo();
        this.updatePublicationsList();
        this.validateForm();
    }

    updateUserInfo() {
        document.getElementById('user-name').textContent = 
            `${this.user.firstName} ${this.user.lastName}`.trim();
        
        // Обновление информации о городе
        const currentCity = this.getCurrentCity();
        if (currentCity) {
            document.getElementById('selected-city').textContent = currentCity.name;
        }
        
        if (this.user.photoUrl) {
            document.getElementById('user-avatar').src = this.user.photoUrl;
        } else {
            document.getElementById('user-avatar').src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iMjUiIGZpbGw9IiNlMGUwZTAiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIyNiIgaGVpZ2h0PSIyNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjNjY2NjY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNEM5LjM5MDg2IDE0IDcuMTY2NjcgMTUuNDE2NyA2IDcuNDE2N0M2IDE5LjQxNjcgOS4zOTA4NiAyMiAxMiAyMkMxNC42MDkxIDIyIDE3IDE5LjQxNjcgMTcgMTcuNDE2N0MxNyIDE1LjQxNjcgMTQuNjA5MSAxNCAxMiAxNFoiIGZpbGw9IiM2NjY2NjYiLz4KPC9zdmc+Cjwvc3ZnPgo=';
        }
    }

    updateCrystalInfo() {
        document.getElementById('crystal-count').textContent = `${this.crystals}/${this.MAX_CRYSTALS}`;
        
        // Обновление таймера до следующего кристалла
        this.updateCrystalTimer();
    }

    updateCrystalTimer() {
        if (this.crystals >= this.MAX_CRYSTALS) {
            document.getElementById('next-crystal-timer').textContent = 
                'Максимум кристаллов достигнут!';
            return;
        }
        
        const now = new Date();
        const timeDiff = now - this.lastCrystalTime;
        const timeUntilNext = (60 * 60 * 1000) - (timeDiff % (60 * 60 * 1000));
        
        const minutes = Math.floor(timeUntilNext / (60 * 1000));
        const seconds = Math.floor((timeUntilNext % (60 * 1000)) / 1000);
        
        document.getElementById('next-crystal-timer').textContent = 
            `Следующий кристалл через: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    updatePublicationsList() {
        const container = document.getElementById('publications-container');
        
        if (this.publications.length === 0) {
            container.innerHTML = '<div class="loading">Пока нет объявлений</div>';
            return;
        }
        
        container.innerHTML = this.publications.map(pub => `
            <div class="publication-item">
                <div class="publication-header">
                    <div class="publication-title">${this.escapeHtml(pub.title)}</div>
                    <div class="publication-price">${pub.price} ₽</div>
                </div>
                <div class="publication-description">${this.escapeHtml(pub.description)}</div>
                ${pub.images.length > 0 ? `
                    <div class="publication-images">
                        ${pub.images.map(img => `<img src="${img.data}" alt="${img.name}">`).join('')}
                    </div>
                ` : ''}
                <div class="publication-meta">
                    <div class="publication-author">
                        <img src="${pub.author.avatar || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMTAiIGZpbGw9IiNlMGUwZTAiLz4KPHN2ZyB4PSI0IiB5PSI0IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xMiAxMkMxNC4yMDkxIDEyIDE2IDEwLjIwOTEgMTYgOEMxNiA1Ljc5MDg2IDE0LjIwOTEgNCAxMiA0QzkuNzkwODYgNCA4IDUuNzkwODYgOCA4QzggMTAuMjA5MSA5Ljc5MDg2IDEyIDEyIDEyWiIgZmlsbD0iIzY2NjY2NiIvPgo8cGF0aCBkPSJNMTIgMTRDOS4zOTA4NiAxNCA3LjE2NjY3IDE1LjQxNjcgNiAxNy40MTY3QzYgMTkuNDE2NyA5LjM5MDg2IDIyIDEyIDIyQzE0LjYwOTEgMjIgMTcgMTkuNDE2NyAxNyAxNy40MTY3QzE3IDE1LjQxNjcgMTQuNjA5MSAxNCAxMiAxNFoiIGZpbGw9IiM2NjY2NjYiLz4KPC9zdmc+Cjwvc3ZnPgo='}" alt="Avatar" class="author-avatar">
                        <span>${this.escapeHtml(pub.author.name)}</span>
                    </div>
                    <div>${new Date(pub.createdAt).toLocaleString('ru-RU')}</div>
                </div>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        document.querySelector('.main-content').insertBefore(errorDiv, document.querySelector('.publication-form'));
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success';
        successDiv.textContent = message;
        document.querySelector('.main-content').insertBefore(successDiv, document.querySelector('.publication-form'));
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // Методы для приветственного экрана
    showWelcomeScreen() {
        document.getElementById('welcome-screen').style.display = 'flex';
        document.getElementById('main-header').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';
    }

    hideWelcomeScreen() {
        document.getElementById('welcome-screen').style.display = 'none';
        this.isFirstVisit = false;
        this.saveAppData();
    }

    showMainApp() {
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('main-header').style.display = 'block';
        document.getElementById('main-content').style.display = 'block';
        this.updateUI();
    }

    // Методы для модального окна
    showInfoModal() {
        document.getElementById('info-modal').classList.add('show');
    }

    hideInfoModal() {
        document.getElementById('info-modal').classList.remove('show');
    }

    // Методы для выбора города
    showCitySelection() {
        document.getElementById('city-selection-screen').style.display = 'flex';
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('main-header').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';
    }

    hideCitySelection() {
        document.getElementById('city-selection-screen').style.display = 'none';
    }

    async selectCity(cityId) {
        const city = this.cities[cityId];
        
        if (!city) {
            console.error('Город не найден:', cityId);
            return;
        }

        if (!city.available) {
            this.telegram.showAlert('Этот город пока недоступен. Скоро добавим!');
            return;
        }

        this.selectedCity = cityId;
        this.saveAppData();
        
        // Обновляем город на сервере
        try {
            await fetch(`${this.API_BASE}/users/${this.user.id}/city`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ city: cityId })
            });
        } catch (error) {
            console.error('Error updating city on server:', error);
        }
        
        // Загружаем публикации для выбранного города
        await this.loadPublicationsFromServer();
        
        this.hideCitySelection();
        this.showMainApp();
        
        // Показываем уведомление
        this.telegram.showAlert(`Выбран город: ${city.name} 🏙️`);
    }

    getCurrentCity() {
        return this.cities[this.selectedCity] || null;
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    new BazaarApp();
});

// Обновление таймера кристаллов каждую секунду
setInterval(() => {
    if (window.bazaarApp) {
        window.bazaarApp.updateCrystalTimer();
    }
}, 1000);
