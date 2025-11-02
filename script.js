// Конфигурация API
const YOUTUBE_API_KEY = 'AIzaSyCpQJ3qWTy7XiCZZRSaijD-EF1igBjtd64';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';

// Глобальные переменные
let currentSearchTerm = '';
let nextPageToken = '';
let isLoading = false;
let currentChannels = [];

// DOM элементы
const channelsContainer = document.getElementById('channelsContainer');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const emptyStateElement = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');
const searchButton = document.getElementById('searchButton');
const clearFiltersBtn = document.getElementById('clearFilters');
const resultsCountElement = document.getElementById('resultsCount');
const searchInfoElement = document.getElementById('searchInfo');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreButton = document.getElementById('loadMoreButton');
const channelModal = document.getElementById('channelModal');
const closeModalBtn = document.querySelector('.close-btn');
const modalBody = document.getElementById('modalBody');

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadPopularChannels();
});

// Настройка обработчиков событий
function setupEventListeners() {
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    clearFiltersBtn.addEventListener('click', clearFilters);
    loadMoreButton.addEventListener('click', loadMoreResults);
    closeModalBtn.addEventListener('click', closeModal);
    channelModal.addEventListener('click', function(e) {
        if (e.target === channelModal) closeModal();
    });
}

// Выполнение поиска
function performSearch() {
    const searchTerm = searchInput.value.trim();
    
    if (!searchTerm) {
        showError('Введите поисковый запрос');
        return;
    }
    
    currentSearchTerm = searchTerm;
    nextPageToken = '';
    currentChannels = [];
    searchChannels(searchTerm);
}

// Реальный поиск каналов через YouTube API
async function searchChannels(query, pageToken = '') {
    try {
        if (!pageToken) {
            showLoading();
        } else {
            loadMoreButton.textContent = 'Загрузка...';
            loadMoreButton.disabled = true;
        }
        
        const params = new URLSearchParams({
            part: 'snippet',
            q: query,
            type: 'channel',
            maxResults: 12,
            key: YOUTUBE_API_KEY
        });
        
        if (pageToken) {
            params.append('pageToken', pageToken);
        }
        
        const sort = sortFilter.value;
        if (sort && sort !== 'relevance') {
            params.append('order', sort);
        }
        
        console.log('Searching with params:', params.toString());
        
        const response = await fetch(`${YOUTUBE_API_URL}/search?${params}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        if (!data.items || data.items.length === 0) {
            if (!pageToken) {
                displayChannels([]);
                hideLoading();
                showError('Каналы не найдены. Попробуйте другой запрос.');
            }
            return;
        }
        
        // Получаем детальную информацию о каналах
        const channelDetails = await getChannelDetails(data.items.map(item => item.snippet.channelId));
        
        if (!pageToken) {
            hideLoading();
            currentChannels = channelDetails;
            displayChannels(channelDetails);
        } else {
            currentChannels = [...currentChannels, ...channelDetails];
            appendChannels(channelDetails);
        }
        
        nextPageToken = data.nextPageToken || '';
        updateStats(currentChannels.length, query);
        
        // Показываем/скрываем кнопку "Загрузить еще"
        if (nextPageToken) {
            loadMoreContainer.style.display = 'block';
        } else {
            loadMoreContainer.style.display = 'none';
        }
        
    } catch (error) {
        hideLoading();
        showError('Ошибка при поиске каналов: ' + error.message);
        console.error('Search error:', error);
    } finally {
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = 'Загрузить еще';
    }
}

// Получение детальной информации о каналах
async function getChannelDetails(channelIds) {
    try {
        const params = new URLSearchParams({
            part: 'snippet,statistics',
            id: channelIds.join(','),
            key: YOUTUBE_API_KEY
        });
        
        const response = await fetch(`${YOUTUBE_API_URL}/channels?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.items) {
            return [];
        }
        
        return data.items.map(channel => ({
            id: channel.id,
            name: channel.snippet.title,
            description: channel.snippet.description,
            avatar: channel.snippet.thumbnails?.default?.url,
            subscribers: parseInt(channel.statistics?.subscriberCount) || 0,
            totalViews: parseInt(channel.statistics?.viewCount) || 0,
            videoCount: parseInt(channel.statistics?.videoCount) || 0,
            createdDate: new Date(channel.snippet.publishedAt).toLocaleDateString('ru-RU'),
            country: channel.snippet.country || 'Не указана',
            customUrl: channel.snippet.customUrl || '',
            thumbnails: channel.snippet.thumbnails,
            statistics: channel.statistics
        }));
        
    } catch (error) {
        console.error('Channel details error:', error);
        throw error;
    }
}

// Загрузка популярных каналов через YouTube API
async function loadPopularChannels() {
    try {
        showLoading();
        
        const popularQueries = ['music', 'gaming', 'sports', 'education', 'entertainment'];
        const randomQuery = popularQueries[Math.floor(Math.random() * popularQueries.length)];
        
        const params = new URLSearchParams({
            part: 'snippet',
            q: randomQuery,
            type: 'channel',
            maxResults: 9,
            key: YOUTUBE_API_KEY
        });
        
        const response = await fetch(`${YOUTUBE_API_URL}/search?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            displayChannels([]);
            hideLoading();
            return;
        }
        
        const channelDetails = await getChannelDetails(data.items.map(item => item.snippet.channelId));
        
        hideLoading();
        currentChannels = channelDetails;
        displayChannels(channelDetails);
        updateStats(channelDetails.length, 'популярные каналы');
        loadMoreContainer.style.display = 'none';
        
    } catch (error) {
        hideLoading();
        showError('Ошибка загрузки каналов: ' + error.message);
        console.error('Popular channels error:', error);
    }
}

// Отображение каналов
function displayChannels(channels) {
    if (channels.length === 0) {
        channelsContainer.style.display = 'none';
        emptyStateElement.style.display = 'block';
        loadMoreContainer.style.display = 'none';
        return;
    }
    
    channelsContainer.style.display = 'grid';
    emptyStateElement.style.display = 'none';
    
    channelsContainer.innerHTML = '';
    
    channels.forEach(channel => {
        const channelCard = createChannelCard(channel);
        channelsContainer.appendChild(channelCard);
    });
}

// Добавление каналов к существующим
function appendChannels(channels) {
    channels.forEach(channel => {
        const channelCard = createChannelCard(channel);
        channelsContainer.appendChild(channelCard);
    });
}

// Создание карточки канала
function createChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.addEventListener('click', () => openChannelModal(channel));
    
    const initials = getChannelInitials(channel.name);
    const avatarUrl = channel.thumbnails?.medium?.url || channel.avatar;
    
    card.innerHTML = `
        <div class="channel-card-header">
            <div class="channel-avatar">
                ${avatarUrl ? 
                    `<img src="${avatarUrl}" alt="${channel.name}" style="width: 100%; height: 100%; border-radius: 50%;">` : 
                    initials
                }
            </div>
            <div class="channel-info">
                <h3>${channel.name}</h3>
                <p>${channel.country} • ${channel.videoCount} видео</p>
            </div>
        </div>
        <div class="channel-card-body">
            <div class="channel-detail">
                <span class="detail-label">Подписчики:</span>
                <span class="detail-value subscriber-count">${formatNumber(channel.subscribers)}</span>
            </div>
            <div class="channel-detail">
                <span class="detail-label">Просмотры:</span>
                <span class="detail-value view-count">${formatNumber(channel.totalViews)}</span>
            </div>
            <div class="channel-detail">
                <span class="detail-label">Видео:</span>
                <span class="detail-value">${channel.videoCount}</span>
            </div>
            <div class="channel-detail">
                <span class="detail-label">Создан:</span>
                <span class="detail-value">${channel.createdDate}</span>
            </div>
        </div>
    `;
    
    return card;
}

// Открытие модального окна с деталями канала
function openChannelModal(channel) {
    modalBody.innerHTML = `
        <div class="channel-details-grid">
            <div class="detail-group">
                <h3>Основная информация</h3>
                <div class="detail-item">
                    <span class="detail-label">Название:</span>
                    <span><strong>${channel.name}</strong></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Подписчики:</span>
                    <span>${formatNumber(channel.subscribers)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Просмотры:</span>
                    <span>${formatNumber(channel.totalViews)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Видео:</span>
                    <span>${channel.videoCount}</span>
                </div>
            </div>
            
            <div class="detail-group">
                <h3>Детали</h3>
                <div class="detail-item">
                    <span class="detail-label">Страна:</span>
                    <span>${channel.country}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Создан:</span>
                    <span>${channel.createdDate}</span>
                </div>
                ${channel.customUrl ? `
                <div class="detail-item">
                    <span class="detail-label">URL:</span>
                    <span>${channel.customUrl}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="detail-group full-width">
                <h3>Описание</h3>
                <p style="white-space: pre-wrap; line-height: 1.4; max-height: 200px; overflow-y: auto;">${channel.description || 'Описание недоступно'}</p>
            </div>
            
            <div class="detail-group full-width">
                <h3>Статистика</h3>
                <div class="channel-stats">
                    <div class="stat-item">
                        <span class="stat-value">${formatNumber(channel.subscribers)}</span>
                        <span class="stat-label">Подписчики</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${formatNumber(channel.totalViews)}</span>
                        <span class="stat-label">Просмотры</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${channel.videoCount}</span>
                        <span class="stat-label">Видео</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    channelModal.style.display = 'flex';
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ: Загрузка дополнительных результатов
function loadMoreResults() {
    if (isLoading || !nextPageToken) return;
    
    isLoading = true;
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = 'Загрузка...';
    
    // Убираем setTimeout и используем Promise
    searchChannels(currentSearchTerm, nextPageToken).finally(() => {
        isLoading = false;
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = 'Загрузить еще';
    });
}

// Сброс фильтров
function clearFilters() {
    searchInput.value = '';
    categoryFilter.value = '';
    sortFilter.value = 'relevance';
    nextPageToken = '';
    currentChannels = [];
    loadPopularChannels();
}

// Обновление статистики
function updateStats(count, query) {
    resultsCountElement.textContent = `Найдено каналов: ${count}`;
    searchInfoElement.textContent = query ? `По запросу: "${query}"` : '';
}

// Закрытие модального окна
function closeModal() {
    channelModal.style.display = 'none';
}

// Утилиты
function getChannelInitials(name) {
    if (!name) return 'YT';
    return name.split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function showLoading() {
    loadingElement.style.display = 'block';
    channelsContainer.style.display = 'none';
    errorElement.style.display = 'none';
    emptyStateElement.style.display = 'none';
    loadMoreContainer.style.display = 'none';
}

function hideLoading() {
    loadingElement.style.display = 'none';
}

function showError(message) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    channelsContainer.style.display = 'none';
    emptyStateElement.style.display = 'none';
    loadingElement.style.display = 'none';
    loadMoreContainer.style.display = 'none';
}
