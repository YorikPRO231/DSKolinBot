const AdminLogsModule = (function() {
    let currentPage = 1;
    let totalEntries = 0;
    let currentQuery = '';
    let currentCategory = 'all';
    let currentDateFrom = '';
    let currentDateTo = '';
    let isLoading = false;
    let dateFromPicker, dateToPicker;

    function closeLogModal() {
        const modal = document.getElementById('logModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    function openLogModal(content) {
        const modal = document.getElementById('logModal');
        const container = document.getElementById('logDetailContent');
        if (!modal || !container) return;
        container.innerHTML = content;
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function initModal() {
        const modal = document.getElementById('logModal');
        if (!modal) return;
        
        modal.onclick = function(e) {
            if (e.target === modal) closeLogModal();
        };
        
        document.getElementById('closeModalBtn')?.addEventListener('click', closeLogModal);
        document.getElementById('closeModalFooterBtn')?.addEventListener('click', closeLogModal);
        
        document.onkeydown = function(e) {
            if (e.key === 'Escape') closeLogModal();
        };
    }

    function showProgress() {
        const container = document.getElementById('progressBarContainer');
        const bar = document.getElementById('progressBar');
        container.style.display = 'block';
        bar.style.width = '0%';
        
        let progress = 0;
        const interval = setInterval(() => {
            if (isLoading) {
                progress = Math.min(progress + 8, 90);
                bar.style.width = progress + '%';
            } else {
                bar.style.width = '100%';
                setTimeout(() => {
                    container.style.display = 'none';
                    bar.style.width = '0%';
                }, 300);
                clearInterval(interval);
            }
        }, 100);
    }

    function getEventClass(eventType) {
        if (!eventType) return '';
        const lowerEvent = eventType.toLowerCase();
        if (lowerEvent.includes('удален') || lowerEvent.includes('бан') || lowerEvent.includes('кик')) {
            return 'event-error';
        }
        if (lowerEvent.includes('изменен') || lowerEvent.includes('редактирован') || lowerEvent.includes('переместился')) {
            return 'event-warning';
        }
        if (lowerEvent.includes('создан') || lowerEvent.includes('присоединился') || lowerEvent.includes('добавлен')) {
            return 'event-success';
        }
        return '';
    }

    function formatDisplayTime(timestamp) {
        if (!timestamp) return '—';
        try {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
            }
            return timestamp;
        } catch (e) {
            return timestamp;
        }
    }

    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = { 
            '&': '&amp;', 
            '<': '&lt;', 
            '>': '&gt;', 
            '"': '&quot;', 
            "'": '&#039;' 
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    async function fetchChannelName(channelId) {
        if (!channelId || !channelId.match(/^\d{17,20}$/)) return channelId;
        try {
            const response = await fetch(`/api/discord/channel/${channelId}/name`);
            const data = await response.json();
            if (data.success && data.name) return data.name;
        } catch(e) {
            console.debug('Failed to fetch channel name', e);
        }
        return channelId;
    }

    async function enrichEntryWithNames(entry) {
        const enriched = { ...entry };
        if (enriched.channelId && (!enriched.channelName || enriched.channelName === enriched.channelId)) {
            enriched.channelName = await fetchChannelName(enriched.channelId);
        }
        return enriched;
    }

    function generateModalContentSync(entry) {
        const eventClass = getEventClass(entry.event);
        let contentHtml = `
            <div class="detail-event-badge ${eventClass}">
                ${escapeHtml(entry.event || 'Событие')}
            </div>
            <div class="detail-grid">
                <div class="detail-card">
                    <div class="detail-card-label">Время события</div>
                    <div class="detail-card-value">${formatDisplayTime(entry.timestamp)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-card-label">ID пользователя</div>
                    <div class="detail-card-value monospace">${entry.userId ? `<code>${escapeHtml(entry.userId)}</code>` : '—'}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-card-label">Пользователь</div>
                    <div class="detail-card-value">${escapeHtml(entry.userName || '—')}</div>
                </div>
        `;
        
        if (entry.channelId || entry.channelName) {
            contentHtml += `
                <div class="detail-card">
                    <div class="detail-card-label">Канал</div>
                    <div class="detail-card-value">${entry.channelName ? `#${escapeHtml(entry.channelName)}` : escapeHtml(entry.channelId || '—')}</div>
                </div>
            `;
        }
        
        if (entry.guildId || entry.guildName) {
            contentHtml += `
                <div class="detail-card">
                    <div class="detail-card-label">Сервер</div>
                    <div class="detail-card-value">${escapeHtml(entry.guildName || entry.guildId || '—')}</div>
                </div>
            `;
        }
        
        if (entry.messageLink) {
            contentHtml += `
                <div class="detail-card">
                    <div class="detail-card-label">Ссылка</div>
                    <div class="detail-card-value">
                        <a href="${escapeHtml(entry.messageLink)}" target="_blank" rel="noopener noreferrer" style="color: var(--log-accent); text-decoration: none;">
                            🔗 Перейти к сообщению
                        </a>
                    </div>
                </div>
            `;
        }
        
        contentHtml += `</div>`;
        
        if (entry.content) {
            contentHtml += `
                <div class="raw-log-section">
                    <div class="raw-log-title">Содержание сообщения</div>
                    <div class="code-view">${escapeHtml(entry.content)}</div>
                </div>
            `;
        }
        
        if (entry.oldContent || entry.newContent) {
            contentHtml += `
                <div class="raw-log-section">
                    <div class="raw-log-title">Изменения в сообщении</div>
                    <div class="content-diff">
                        <div class="diff-old">
                            <div class="diff-label">Было:</div>
                            <div class="code-view" style="background: rgba(231, 76, 60, 0.1);">${escapeHtml(entry.oldContent || '(пусто)')}</div>
                        </div>
                        <div class="diff-new">
                            <div class="diff-label">Стало:</div>
                            <div class="code-view" style="background: rgba(46, 204, 113, 0.1);">${escapeHtml(entry.newContent || '(пусто)')}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        contentHtml += `
            <div class="raw-log-section">
                <div class="raw-log-title">Полный лог записи</div>
                <div class="code-view">${escapeHtml(entry.raw || 'Нет данных')}</div>
            </div>
            <div class="raw-log-section">
                <div class="raw-log-title">Источник</div>
                <div class="code-view" style="font-size: 11px; background: rgba(0,0,0,0.2);">${escapeHtml(entry.file || '—')}</div>
            </div>
        `;
        
        return contentHtml;
    }

    async function openLogModalWithEntry(entry) {
        openLogModal('<div style="text-align: center; padding: 40px;">Загрузка деталей...</div>');
        try {
            const enrichedEntry = await enrichEntryWithNames(entry);
            const content = generateModalContentSync(enrichedEntry);
            const container = document.getElementById('logDetailContent');
            if (container) container.innerHTML = content;
        } catch (error) {
            console.error('Error loading log details:', error);
            const container = document.getElementById('logDetailContent');
            if (container) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--log-error);">Ошибка загрузки деталей</div>';
            }
        }
    }

    function bindRowClickHandlers() {
        document.querySelectorAll('.row-clickable').forEach(row => {
            if (row._clickHandler) row.removeEventListener('click', row._clickHandler);
            
            const handler = async function() {
                const index = parseInt(this.getAttribute('data-log-index'));
                if (window.logEntriesData && window.logEntriesData[index]) {
                    await openLogModalWithEntry(window.logEntriesData[index]);
                }
            };
            
            row._clickHandler = handler;
            row.addEventListener('click', handler);
        });
    }

    async function performSearch(page = 1) {
        if (isLoading) return;
        isLoading = true;
        
        currentPage = page;
        currentQuery = document.getElementById('searchInput').value;
        currentCategory = document.getElementById('categoryFilter').value;
        currentDateFrom = document.getElementById('dateFrom').value;
        currentDateTo = document.getElementById('dateTo').value;
        
        showProgress();
        
        const body = document.getElementById('logsTableBody');
        body.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 50px;"><div class="loading-skeleton">Загрузка архивов...</div></td></tr>';
        
        const startTime = performance.now();
        
        try {
            const params = new URLSearchParams({
                q: currentQuery,
                category: currentCategory,
                limit: '50',
                offset: ((page - 1) * 50).toString()
            });
            
            if (currentDateFrom) params.append('dateFrom', currentDateFrom);
            if (currentDateTo) params.append('dateTo', currentDateTo);
            
            const response = await fetch(`/admin-logs/search?${params.toString()}`);
            const data = await response.json();
            const endTime = performance.now();
            const queryTime = Math.round(endTime - startTime);
            
            if (!data.entries || data.entries.length === 0) {
                body.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 50px; color: var(--log-text-dim);">Ничего не найдено</td></tr>';
                document.getElementById('pagination').style.display = 'none';
                document.getElementById('searchStats').style.display = 'none';
                isLoading = false;
                return;
            }
            
            totalEntries = data.total;
            window.logEntriesData = data.entries;
            
            body.innerHTML = data.entries.map((entry, index) => {
                const eventClass = getEventClass(entry.event);
                const displayTime = formatDisplayTime(entry.timestamp);
                const displayId = entry.userId || 'Система';
                const displayDesc = truncateText(entry.description || entry.event || 'Нет описания', 120);
                
                return `
                    <tr class="row-clickable" data-log-index="${index}">
                        <td style="color: var(--log-text-dim); white-space: nowrap;">${displayTime}</td>
                        <td><span class="tag-event ${eventClass}">${escapeHtml(entry.event || 'Лог')}</span></td>
                        <td class="id-cell"><code style="font-size: 12px;">${escapeHtml(displayId)}</code></td>
                        <td style="max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(displayDesc)}">${escapeHtml(displayDesc)}</td>
                    </tr>
                `;
            }).join('');
            
            bindRowClickHandlers();
            
            const statsDiv = document.getElementById('searchStats');
            statsDiv.style.display = 'flex';
            document.getElementById('totalCount').innerText = totalEntries;
            document.getElementById('queryTime').innerText = queryTime;
            
            const totalPages = Math.ceil(totalEntries / 50);
            const paginationDiv = document.getElementById('pagination');
            
            if (totalPages > 1) {
                paginationDiv.style.display = 'flex';
                document.getElementById('pageInfo').innerHTML = `Страница ${currentPage} из ${totalPages} <span style="color: var(--log-text-dim);">(всего ${totalEntries} записей)</span>`;
                document.getElementById('prevPageBtn').disabled = currentPage === 1;
                document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
            } else {
                paginationDiv.style.display = 'none';
            }
        } catch (e) {
            console.error('Search error:', e);
            body.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 50px; color: #ff5f5f;">Ошибка при выполнении поиска</td></tr>';
            document.getElementById('searchStats').style.display = 'none';
            document.getElementById('pagination').style.display = 'none';
        } finally {
            isLoading = false;
        }
    }

    function changePage(delta) {
        const newPage = currentPage + delta;
        const maxPage = Math.ceil(totalEntries / 50);
        if (newPage >= 1 && newPage <= maxPage) performSearch(newPage);
    }

    function resetFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('categoryFilter').value = 'all';
        if (dateFromPicker) dateFromPicker.clear();
        if (dateToPicker) dateToPicker.clear();
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        performSearch(1);
    }

    function initDatePickers() {
        if (typeof flatpickr !== 'undefined') {
            dateFromPicker = flatpickr("#dateFrom", {
                locale: "ru",
                dateFormat: "Y-m-d",
                theme: "dark",
                onChange: function(selectedDates, dateStr) { 
                    performSearch(1); 
                }
            });
            
            dateToPicker = flatpickr("#dateTo", {
                locale: "ru",
                dateFormat: "Y-m-d",
                theme: "dark",
                onChange: function(selectedDates, dateStr) { 
                    performSearch(1); 
                }
            });
        }
    }

    return {
        performSearch,
        changePage,
        resetFilters,
        initModal,
        initDatePickers,
        closeLogModal
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    AdminLogsModule.initModal();
    AdminLogsModule.initDatePickers();
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') AdminLogsModule.performSearch(1);
        });
    }
    
    AdminLogsModule.performSearch(1);
    
    window.performSearch = AdminLogsModule.performSearch;
    window.changePage = AdminLogsModule.changePage;
    window.resetFilters = AdminLogsModule.resetFilters;
});