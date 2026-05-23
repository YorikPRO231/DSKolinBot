const SecurityModule = (function() {
    let pendingAction = null;
    let pendingId = null;
    let currentFilterValue = 'ALL';
    let currentPage = 1;
    let totalPages = 1;
    let totalItems = 0;
    const limit = 20;
    const nicknameCache = {};
    let selectedAlertType = 'Cheats';

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function toggleDropdown() {
        const dropdown = document.getElementById('typeDropdown');
        dropdown.classList.toggle('open');
    }

    function selectDropdownItem(element) {
        const value = element.getAttribute('data-value');
        const html = element.innerHTML;
        
        document.getElementById('dropdownSelectedValue').innerHTML = html;
        currentFilterValue = value;
        currentPage = 1;
        
        const items = document.querySelectorAll('.dropdown-item');
        items.forEach(item => item.classList.remove('active'));
        element.classList.add('active');
        
        document.getElementById('typeDropdown').classList.remove('open');
        loadAlerts();
    }

    function toggleAlertTypeDropdown() {
        const dropdown = document.getElementById('alertTypeDropdown');
        if (dropdown) {
            dropdown.classList.toggle('open');
        }
    }

    function selectAlertType(element) {
        const value = element.getAttribute('data-value');
        const text = element.innerText.trim();
        const iconHtml = element.querySelector('i')?.outerHTML || '';
        
        selectedAlertType = value;
        
        const triggerSpan = document.getElementById('alertTypeSelectedValue');
        if (triggerSpan) {
            triggerSpan.innerHTML = iconHtml + ' ' + text;
        }
        
        const dropdown = document.getElementById('alertTypeDropdown');
        if (dropdown) {
            dropdown.classList.remove('open');
        }
        
        document.querySelectorAll('#alertTypeDropdown .dropdown-item').forEach(item => {
            item.classList.remove('active');
        });
        element.classList.add('active');
    }

    async function getNickname(adminId) {
        if (!adminId) return '-';
        if (nicknameCache[adminId]) return nicknameCache[adminId];
        
        try {
            const response = await fetch('/api/discord/user/nickname/' + adminId);
            const data = await response.json();
            if (data.success) {
                nicknameCache[adminId] = data.nickname;
                return data.nickname;
            }
        } catch (error) {
            console.error('Ошибка получения ника:', error);
        }
        return adminId;
    }

    function showModal(modalId) {
        Utils.showModal(modalId);
    }

    function closeModal(modalId) {
        Utils.closeModal(modalId);
    }

    function updatePagination() {
        const paginationDiv = document.getElementById('pagination');
        const pageInfoSpan = document.getElementById('pageInfo');
        
        if (paginationDiv && totalPages > 1) {
            paginationDiv.style.display = 'flex';
            if (pageInfoSpan) {
                pageInfoSpan.innerHTML = `Страница ${currentPage} из ${totalPages} <span style="color: var(--text-dim);">(всего ${totalItems})</span>`;
            }
            const prevBtn = document.getElementById('prevPageBtn');
            const nextBtn = document.getElementById('nextPageBtn');
            if (prevBtn) prevBtn.disabled = currentPage === 1;
            if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
        } else if (paginationDiv) {
            paginationDiv.style.display = 'none';
        }
    }

    async function loadAlerts(page = 1) {
        currentPage = page;
        const type = currentFilterValue;
        const search = document.getElementById('alertSearch').value;
        
        let url = '/api/security/alerts';
        const params = [];
        if (type && type !== 'ALL') params.push('type=' + type);
        if (search) params.push('suspect=' + encodeURIComponent(search));
        params.push('page=' + currentPage);
        params.push('limit=' + limit);
        if (params.length) url += '?' + params.join('&');
        
        const tbody = document.getElementById('alertsList');
        tbody.innerHTML = '<tr><td colspan="7" class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка...</td></tr>';
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success && data.alerts && data.alerts.length > 0) {
                totalPages = data.totalPages || 1;
                totalItems = data.total || data.alerts.length;
                updatePagination();
                
                let html = '';
                for (let i = 0; i < data.alerts.length; i++) {
                    const alert = data.alerts[i];
                    const typeClass = alert.type === 'Bots' ? 'text-bots' : 'text-cheats';
                    const typeIcon = alert.type === 'Bots' ? 'fa-robot' : 'fa-gamepad';
                    const typeText = alert.type === 'Bots' ? 'Боты' : 'Читы';
                    
                    let reason = alert.reason || '';
                    let shortReason = reason.length > 60 ? reason.substring(0, 60) + '...' : reason;
                    
                    const adminNickname = await getNickname(alert.author_id);
                    
                    html += `<tr class="clickable-row" onclick="if(!event.target.closest('.btn-icon')) SecurityModule.showFullData(${alert.id}, 'alert')">` +
                        '<td><strong>' + Utils.escapeHtml(alert.passport) + '</strong></td>' +
                        '<td><span class="type-badge ' + typeClass + '"><i class="fas ' + typeIcon + '"></i> ' + typeText + '</span></td>' +
                        '<td><div class="table-text-truncated">' + Utils.escapeHtml(shortReason) + ' <i class="fas fa-expand" style="font-size: 0.7rem; opacity: 0.5;"></i></div></td>' +
                        '<td><span title="ID: ' + Utils.escapeHtml(alert.author_id || '-') + '">' + Utils.escapeHtml(adminNickname) + '</span></td>' +
                        '<td style="text-align: center;"><span class="count-badge">' + (alert.count || 0) + '</span></td>' +
                        '<td><small>' + Utils.formatDate(alert.created_at) + '</small></td>' +
                        '<td><button class="btn-icon btn-delete" onclick="SecurityModule.confirmDeleteAlert(' + alert.id + ')" title="Удалить"><i class="fas fa-trash"></i></button></td>' +
                    '</tr>';
                }
                tbody.innerHTML = html;
            } else {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-folder-open"></i><br>Нет алертов</td></tr>';
                document.getElementById('pagination').style.display = 'none';
            }
        } catch (error) {
            console.error('Ошибка:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="error-message">Ошибка загрузки</td></tr>';
        }
    }

    function changePage(delta) {
        const newPage = currentPage + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            loadAlerts(newPage);
        }
    }

    async function showFullData(alertId, type) {
        const detailsContent = document.getElementById('detailsContent');
        try {
            const response = await fetch('/api/security/alerts/' + alertId);
            const data = await response.json();
            if (!data.success || !data.alert) {
                detailsContent.innerHTML = '<div style="text-align: center;">Ошибка загрузки данных</div>';
                showModal('detailsModal');
                return;
            }
            const alert = data.alert;
            let reason = alert.reason || 'Нет данных';
            reason = reason.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--accent);">$1</a>');
            const adminNickname = await getNickname(alert.author_id);
            const typeClass = alert.type === 'Bots' ? 'text-bots' : 'text-cheats';
            const typeIcon = alert.type === 'Bots' ? 'fa-robot' : 'fa-gamepad';
            const typeText = alert.type === 'Bots' ? 'Боты' : 'Читы';
            
            detailsContent.innerHTML = `
                <div class="detail-row"><div class="detail-label">Статик</div><div class="detail-value"><strong>${Utils.escapeHtml(alert.passport)}</strong></div></div>
                <div class="detail-row"><div class="detail-label">Тип</div><div class="detail-value"><span class="type-badge ${typeClass}"><i class="fas ${typeIcon}"></i> ${typeText}</span></div></div>
                <div class="detail-row"><div class="detail-label">Причина</div><div class="detail-value">${reason}</div></div>
                <div class="detail-row"><div class="detail-label">Кто добавил</div><div class="detail-value">${Utils.escapeHtml(adminNickname)} <small style="color: var(--text-dim);">(${Utils.escapeHtml(alert.author_id) || '-'})</small></div></div>
                <div class="detail-row"><div class="detail-label">Количество</div><div class="detail-value"><span class="count-badge">${alert.count || 0}</span></div></div>
                <div class="detail-row"><div class="detail-label">Дата создания</div><div class="detail-value">${Utils.formatDate(alert.created_at)}</div></div>
            `;
            showModal('detailsModal');
        } catch (error) {
            console.error(error);
            detailsContent.innerHTML = '<div style="text-align: center;">Ошибка загрузки данных</div>';
            showModal('detailsModal');
        }
    }

    function confirmDeleteAlert(id) {
        pendingAction = 'delete';
        pendingId = id;
        showConfirmModal('Подтверждение удаления', 'Вы уверены, что хотите удалить этот алерт?');
    }

    async function executePendingAction() {
        if (!pendingAction || !pendingId) return;
        const confirmBtn = document.getElementById('confirmActionBtn');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Удаление...';
        confirmBtn.disabled = true;
        
        try {
            const response = await fetch('/api/security/alerts/' + pendingId + '/close', { method: 'POST' });
            const data = await response.json();
            closeModal('confirmModal');
            
            if (data.success) {
                Utils.showToast('Алерт успешно удален');
                loadAlerts(currentPage);
            } else {
                Utils.showToast(data.error || 'Произошла ошибка', true);
            }
        } catch (error) {
            closeModal('confirmModal');
            Utils.showToast('Ошибка сервера', true);
        } finally {
            pendingAction = null;
            pendingId = null;
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }
    }

    function showConfirmModal(title, message) {
        document.getElementById('confirmTitle').innerText = title;
        document.getElementById('confirmMessage').innerText = message;
        showModal('confirmModal');
    }

    function openAddPlayerModal() {
        document.getElementById('playerStatic').value = '';
        document.getElementById('playerReason').value = '';
        selectedAlertType = 'Cheats';
        
        const triggerSpan = document.getElementById('alertTypeSelectedValue');
        if (triggerSpan) {
            triggerSpan.innerHTML = '<i class="fas fa-gamepad text-cheats"></i> Читы';
        }
        
        document.querySelectorAll('#alertTypeDropdown .dropdown-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-value') === 'Cheats') {
                item.classList.add('active');
            }
        });
        
        showModal('addPlayerModal');
    }

    async function addPlayerToSecurity() {
        const playerId = document.getElementById('playerStatic').value.trim();
        const reason = document.getElementById('playerReason').value.trim();
        const type = selectedAlertType;
        
        if (!playerId || !/^\d+$/.test(playerId)) {
            Utils.showToast('Введите корректный ID игрока', true);
            return;
        }
        
        if (!reason) {
            Utils.showToast('Укажите причину', true);
            return;
        }
        
        const addBtn = document.querySelector('#addPlayerModal .btn-primary');
        const originalText = addBtn.innerHTML;
        addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Добавление...';
        addBtn.disabled = true;
        
        try {
            const response = await fetch('/api/security/alerts/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suspect: playerId, action: reason, data: reason, type: type })
            });
            const data = await response.json();
            if (data.success) {
                closeModal('addPlayerModal');
                Utils.showToast('Игрок добавлен в список');
                loadAlerts(1);
            } else {
                Utils.showToast(data.error || 'Не удалось добавить игрока', true);
            }
        } catch (error) {
            Utils.showToast('Ошибка сервера', true);
        } finally {
            addBtn.innerHTML = originalText;
            addBtn.disabled = false;
        }
    }

    async function copyAllStats() {
        try {
            const response = await fetch('/api/security/alerts' + (currentFilterValue !== 'ALL' ? '?type=' + currentFilterValue : ''));
            const data = await response.json();
            if (data.success && data.alerts && data.alerts.length > 0) {
                const statsList = data.alerts.map(a => a.passport).join('\n');
                await navigator.clipboard.writeText(statsList);
                Utils.showToast(`Скопировано статиков: ${data.alerts.length}`);
            } else {
                Utils.showToast('Нет данных для копирования', true);
            }
        } catch (e) { 
            console.error(e);
            Utils.showToast('Не удалось скопировать', true);
        }
    }

    function initGlobalListeners() {
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal')) {
                closeModal(e.target.id);
            }
            
            const dropdown = document.getElementById('typeDropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
            
            const alertTypeDropdown = document.getElementById('alertTypeDropdown');
            if (alertTypeDropdown && !alertTypeDropdown.contains(e.target)) {
                alertTypeDropdown.classList.remove('open');
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.show');
                if (activeModal) closeModal(activeModal.id);
            }
        });
        
        const confirmCancelBtn = document.getElementById('confirmCancelBtn');
        if (confirmCancelBtn) {
            confirmCancelBtn.onclick = () => closeModal('confirmModal');
        }
        
        const confirmActionBtn = document.getElementById('confirmActionBtn');
        if (confirmActionBtn) {
            confirmActionBtn.onclick = () => executePendingAction();
        }
    }

    return {
        loadAlerts,
        debouncedLoadAlerts: debounce(() => loadAlerts(1), 350),
        toggleDropdown,
        selectDropdownItem,
        toggleAlertTypeDropdown,
        selectAlertType,
        showFullData,
        confirmDeleteAlert,
        executePendingAction,
        openAddPlayerModal,
        addPlayerToSecurity,
        copyAllStats,
        changePage,
        initGlobalListeners,
        closeModal
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    SecurityModule.loadAlerts(1);
    SecurityModule.initGlobalListeners();
    
    window.SecurityModule = SecurityModule;
    window.openAddPlayerModal = () => SecurityModule.openAddPlayerModal();
    window.addPlayerToSecurity = () => SecurityModule.addPlayerToSecurity();
    window.copyAllStats = () => SecurityModule.copyAllStats();
    window.closeModal = (id) => SecurityModule.closeModal(id);
    window.changePage = (delta) => SecurityModule.changePage(delta);
});