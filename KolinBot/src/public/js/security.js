const SecurityModule = (function() {
    let pendingAction = null;
    let pendingId = null;
    let currentFilterValue = 'ALL'; 
    const nicknameCache = {};

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
        
        const items = document.querySelectorAll('.dropdown-item');
        items.forEach(item => item.classList.remove('active'));
        element.classList.add('active');
        
        document.getElementById('typeDropdown').classList.remove('open');
        loadAlerts();
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

    function escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            if (!document.querySelector('.modal.show')) {
                document.body.style.overflow = '';
            }
        }
    }

    async function loadAlerts() {
        const type = currentFilterValue; 
        const search = document.getElementById('alertSearch').value;
        
        let url = '/api/security/alerts';
        const params = [];
        if (type && type !== 'ALL') params.push('type=' + type);
        if (search) params.push('suspect=' + encodeURIComponent(search));
        if (params.length) url += '?' + params.join('&');
        
        const tbody = document.getElementById('alertsList');
        tbody.innerHTML = '<tr><td colspan="7" class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка...</td></tr>';
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success && data.alerts && data.alerts.length > 0) {
                let html = '';
                for (let i = 0; i < data.alerts.length; i++) {
                    const alert = data.alerts[i];
                    const typeClass = alert.type === 'Bots' ? 'badge-bots' : 'badge-cheats';
                    const typeText = alert.type === 'Bots' ? 'Боты' : 'Читы';
                    
                    let reason = alert.reason || '';
                    let shortReason = reason.length > 60 ? reason.substring(0, 60) + '...' : reason;
                    
                    const adminNickname = await getNickname(alert.author_id);
                    const alertJson = JSON.stringify(alert).replace(/"/g, '&quot;');
                    
                    html += `<tr class="clickable-row" onclick="if(!event.target.closest('.btn-icon')) SecurityModule.showFullData(${alertJson}, 'alert')">` +
                        '<td><strong>' + escapeHtml(alert.passport) + '</strong></td>' +
                        '<td><span class="badge ' + typeClass + '">' + typeText + '</span></td>' +
                        '<td><div class="table-text-truncated">' + escapeHtml(shortReason) + ' <i class="fas fa-expand" style="font-size: 0.7rem; opacity: 0.5;"></i></div></td>' +
                        '<td><span title="ID: ' + escapeHtml(alert.author_id || '-') + '">' + escapeHtml(adminNickname) + '</span></td>' +
                        '<td style="text-align: center;"><span class="badge">' + (alert.count || 0) + '</span></td>' +
                        '<td><small>' + new Date(alert.created_at).toLocaleString() + '</small></td>' +
                        '<td><button class="btn-icon btn-delete" onclick="SecurityModule.confirmDeleteAlert(' + alert.id + ')" title="Удалить"><i class="fas fa-trash"></i></button></td>' +
                    '</tr>';
                }
                tbody.innerHTML = html;
            } else {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-folder-open"></i><br>Нет алертов</td></tr>';
            }
        } catch (error) {
            console.error('Ошибка:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="error-message">Ошибка загрузки</td></tr>';
        }
    }

    async function showFullData(data, type) {
        const detailsContent = document.getElementById('detailsContent');
        if (type === 'alert') {
            let reason = data.reason || 'Нет данных';
            reason = reason.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--accent);">$1</a>');
            const adminNickname = await getNickname(data.author_id);
            
            detailsContent.innerHTML = `
                <div class="detail-row"><div class="detail-label">Статик</div><div class="detail-value"><strong>${escapeHtml(data.passport)}</strong></div></div>
                <div class="detail-row"><div class="detail-label">Тип</div><div class="detail-value">${data.type === 'Bots' ? 'Боты' : 'Читы'}</div></div>
                <div class="detail-row"><div class="detail-label">Причина</div><div class="detail-value">${reason}</div></div>
                <div class="detail-row"><div class="detail-label">Кто добавил</div><div class="detail-value">${escapeHtml(adminNickname)} <small style="color: var(--text-dim);">(${escapeHtml(data.author_id) || '-'})</small></div></div>
                <div class="detail-row"><div class="detail-label">Количество</div><div class="detail-value">${data.count || 0}</div></div>
                <div class="detail-row"><div class="detail-label">Дата создания</div><div class="detail-value">${new Date(data.created_at).toLocaleString()}</div></div>
            `;
        }
        showModal('detailsModal');
    }

    function confirmDeleteAlert(id) {
        pendingAction = 'delete';
        pendingId = id;
        showConfirmModal('Удалить алерт', 'Вы уверены, что хотите удалить этот алерт?');
    }

    async function executePendingAction() {
        if (!pendingAction || !pendingId) return;
        const confirmBtn = document.getElementById('confirmActionBtn');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>...';
        confirmBtn.disabled = true;
        
        try {
            const response = await fetch('/api/security/alerts/' + pendingId + '/close', { method: 'POST' });
            const data = await response.json();
            closeModal('confirmModal');
            
            if (data.success) {
                showNotificationModal('Успех', 'Алерт успешно удален', 'success');
                loadAlerts();
            } else {
                showNotificationModal('Ошибка', data.error || 'Произошла ошибка', 'error');
            }
        } catch (error) {
            closeModal('confirmModal');
            showNotificationModal('Ошибка', 'Ошибка сервера', 'error');
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

    function showNotificationModal(title, message, type) {
        const icon = document.getElementById('notificationIcon');
        const iconTitle = document.getElementById('notificationTitle');
        
        if (type === 'success') { icon.className = 'fas fa-check-circle'; icon.style.color = '#00c853'; }
        else if (type === 'error') { icon.className = 'fas fa-times-circle'; icon.style.color = '#ff4d4d'; }
        
        iconTitle.innerText = title;
        document.getElementById('notificationMessage').innerText = message;
        showModal('notificationModal');
        setTimeout(() => closeModal('notificationModal'), 2500);
    }

    function openAddPlayerModal() {
        document.getElementById('playerStatic').value = '';
        document.getElementById('playerReason').value = '';
        showModal('addPlayerModal');
    }

    async function addPlayerToSecurity() {
        const playerId = document.getElementById('playerStatic').value.trim();
        const reason = document.getElementById('playerReason').value.trim();
        const type = document.getElementById('alertType').value;
        
        if (!playerId || !/^\d+$/.test(playerId) || !reason) {
            showNotificationModal('Ошибка', 'Проверьте корректность данных', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/security/alerts/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suspect: playerId, action: reason, data: reason, type: type })
            });
            const data = await response.json();
            if (data.success) {
                closeModal('addPlayerModal');
                showNotificationModal('Успех', 'Игрок добавлен', 'success');
                loadAlerts();
            }
        } catch (error) {
            showNotificationModal('Ошибка', 'Ошибка сервера', 'error');
        }
    }

    async function copyAllStats() {
        try {
            const response = await fetch('/api/security/alerts' + (currentFilterValue !== 'ALL' ? '?type=' + currentFilterValue : ''));
            const data = await response.json();
            if (data.success && data.alerts.length > 0) {
                const statsList = data.alerts.map(a => a.passport).join('\n');
                await navigator.clipboard.writeText(statsList);
                showNotificationModal('Успех', `Скопировано статиков: ${data.alerts.length}`, 'success');
            }
        } catch (e) { console.error(e); }
    }

    function initGlobalListeners() {
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal')) closeModal(e.target.id);
            
            const dropdown = document.getElementById('typeDropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.show');
                if (activeModal) closeModal(activeModal.id);
            }
        });
    }

    return {
        loadAlerts,
        debouncedLoadAlerts: debounce(loadAlerts, 350),
        toggleDropdown,
        selectDropdownItem,
        showFullData,
        confirmDeleteAlert,
        executePendingAction,
        openAddPlayerModal,
        addPlayerToSecurity,
        copyAllStats,
        initGlobalListeners
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    SecurityModule.loadAlerts();
    SecurityModule.initGlobalListeners();
    
    window.copyAllStats = SecurityModule.copyAllStats;
    window.openAddPlayerModal = SecurityModule.openAddPlayerModal;
    window.addPlayerToSecurity = SecurityModule.addPlayerToSecurity;
    window.closeModal = (id) => document.getElementById(id).classList.remove('show');
});