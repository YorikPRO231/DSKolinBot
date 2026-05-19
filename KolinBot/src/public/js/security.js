const SecurityModule = (function() {
    let pendingAction = null;
    let pendingId = null;
    const nicknameCache = {};

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
        const map = { 
            '&': '&amp;', 
            '<': '&lt;', 
            '>': '&gt;', 
            '"': '&quot;', 
            "'": '&#039;' 
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    async function loadAlerts() {
        const status = document.getElementById('alertStatusFilter').value;
        const search = document.getElementById('alertSearch').value;
        
        let url = '/api/security/alerts';
        const params = [];
        if (status !== 'ALL') params.push('status=' + status);
        if (search) params.push('suspect=' + encodeURIComponent(search));
        if (params.length) url += '?' + params.join('&');
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            const tbody = document.getElementById('alertsList');
            
            if (data.success && data.alerts && data.alerts.length > 0) {
                let html = '';
                for (let i = 0; i < data.alerts.length; i++) {
                    const alert = data.alerts[i];
                    const statusClass = alert.status === 'OPEN' ? 'badge-open' : 'badge-closed';
                    const statusText = alert.status === 'OPEN' ? 'Открыт' : 'Закрыт';
                    const actions = alert.status === 'OPEN' 
                        ? '<button class="btn-icon" onclick="SecurityModule.confirmCloseAlert(' + alert.id + ')" title="Закрыть"><i class="fas fa-check"></i></button>'
                        : '<button class="btn-icon" onclick="SecurityModule.confirmReopenAlert(' + alert.id + ')" title="Открыть"><i class="fas fa-undo"></i></button>';
                    
                    let workData = alert.work_data || '';
                    let shortData = workData.length > 60 ? workData.substring(0, 60) + '...' : workData;
                    
                    const adminNickname = await getNickname(alert.admin_id);
                    
                    html += '<tr>' +
                        '<td><strong>' + escapeHtml(alert.suspect) + '</strong></td>' +
                        '<td>' + escapeHtml(alert.suspected_action) + '</td>' +
                        '<td><div class="clickable-data" onclick="SecurityModule.showFullData(' + JSON.stringify(alert).replace(/"/g, '&quot;') + ', \'alert\')" title="Нажмите для просмотра полных данных">' + escapeHtml(shortData) + ' <i class="fas fa-expand" style="font-size: 0.7rem;"></i></div></td>' +
                        '<td><span title="ID: ' + escapeHtml(alert.admin_id || '-') + '">' + escapeHtml(adminNickname) + '</span></td>' +
                        '<td style="text-align: center;"><span class="badge">' + (alert.count || 0) + '</span></td>' +
                        '<td><small>' + new Date(alert.created_at).toLocaleString() + '</small></td>' +
                        '<td><span class="badge ' + statusClass + '">' + statusText + '</span></td>' +
                        '<td>' + actions + '</td>' +
                    '</tr>';
                }
                tbody.innerHTML = html;
            } else {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center">Нет алертов</td></tr>';
            }
        } catch (error) {
            console.error('Ошибка:', error);
            document.getElementById('alertsList').innerHTML = '<tr><td colspan="8" class="error-message">Ошибка загрузки</td></tr>';
        }
    }

    async function loadLogs() {
        try {
            const response = await fetch('/api/security/logs?limit=100');
            const data = await response.json();
            const tbody = document.getElementById('logsList');
            
            if (data.success && data.logs && data.logs.length > 0) {
                let html = '';
                for (let i = 0; i < data.logs.length; i++) {
                    const log = data.logs[i];
                    let checkResults = log.check_results || '';
                    let shortResults = checkResults.length > 60 ? checkResults.substring(0, 60) + '...' : checkResults;
                    
                    const adminNickname = await getNickname(log.admin_id);
                    
                    html += '<tr>' +
                        '<td>' + escapeHtml(log.username) + '</td>' +
                        '<td>' + escapeHtml(log.suspected_action) + '</td>' +
                        '<td><div class="clickable-data" onclick="SecurityModule.showFullData(' + JSON.stringify(log).replace(/"/g, '&quot;') + ', \'log\')" title="Нажмите для просмотра полных данных">' + escapeHtml(shortResults) + ' <i class="fas fa-expand" style="font-size: 0.7rem;"></i></div></td>' +
                        '<td><span title="ID: ' + escapeHtml(log.admin_id || '-') + '">' + escapeHtml(adminNickname) + '</span></td>' +
                        '<td><small>' + new Date(log.checked_at).toLocaleString() + '</small></td>' +
                    '</tr>';
                }
                tbody.innerHTML = html;
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">Нет логов</td></tr>';
            }
        } catch (error) {
            console.error('Ошибка:', error);
            document.getElementById('logsList').innerHTML = '<tr><td colspan="5" class="error-message">Ошибка загрузки</td></tr>';
        }
    }

    async function showFullData(data, type) {
        const detailsContent = document.getElementById('detailsContent');
        const adminNickname = await getNickname(data.admin_id);
        
        if (type === 'alert') {
            let workData = data.work_data || 'Нет данных';
            workData = workData.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--accent);">$1</a>');
            
            detailsContent.innerHTML = `
                <div class="detail-row">
                    <div class="detail-label">Подозреваемый</div>
                    <div class="detail-value"><strong>${escapeHtml(data.suspect)}</strong></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Действие</div>
                    <div class="detail-value">${escapeHtml(data.suspected_action)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Полные данные</div>
                    <div class="detail-value">${workData}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Администратор</div>
                    <div class="detail-value">${escapeHtml(adminNickname)} <small style="color: var(--text-dim);">(${escapeHtml(data.admin_id) || '-'})</small></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Количество</div>
                    <div class="detail-value">${data.count || 0}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Дата создания</div>
                    <div class="detail-value">${new Date(data.created_at).toLocaleString()}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Статус</div>
                    <div class="detail-value">${data.status === 'OPEN' ? 'Открыт' : 'Закрыт'}</div>
                </div>
            `;
        } else if (type === 'log') {
            let checkResults = data.check_results || 'Нет данных';
            checkResults = checkResults.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--accent);">$1</a>');
            
            detailsContent.innerHTML = `
                <div class="detail-row">
                    <div class="detail-label">Пользователь</div>
                    <div class="detail-value"><strong>${escapeHtml(data.username)}</strong></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Действие</div>
                    <div class="detail-value">${escapeHtml(data.suspected_action)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Результат проверки</div>
                    <div class="detail-value">${checkResults}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Администратор</div>
                    <div class="detail-value">${escapeHtml(adminNickname)} <small style="color: var(--text-dim);">(${escapeHtml(data.admin_id) || '-'})</small></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Дата проверки</div>
                    <div class="detail-value">${new Date(data.checked_at).toLocaleString()}</div>
                </div>
            `;
        }
        
        showModal('detailsModal');
    }

    function confirmCloseAlert(id) {
        pendingAction = 'close';
        pendingId = id;
        showConfirmModal('Закрыть алерт', 'Вы уверены, что хотите закрыть этот алерт?');
    }

    function confirmReopenAlert(id) {
        pendingAction = 'reopen';
        pendingId = id;
        showConfirmModal('Открыть алерт', 'Вы уверены, что хотите открыть этот алерт заново?');
    }

    async function executePendingAction() {
        if (!pendingAction || !pendingId) return;
        
        try {
            let response;
            if (pendingAction === 'close') {
                response = await fetch('/api/security/alerts/' + pendingId + '/close', { method: 'POST' });
            } else if (pendingAction === 'reopen') {
                response = await fetch('/api/security/alerts/' + pendingId + '/reopen', { method: 'POST' });
            }
            
            const data = await response.json();
            closeModal('confirmModal');
            
            if (data.success) {
                const message = pendingAction === 'close' ? 'Алерт успешно закрыт' : 'Алерт успешно открыт';
                showNotificationModal('Успех', message, 'success');
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
        }
    }

    function showConfirmModal(title, message) {
        document.getElementById('confirmTitle').innerText = title;
        document.getElementById('confirmMessage').innerText = message;
        
        const confirmBtn = document.getElementById('confirmActionBtn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        newConfirmBtn.id = 'confirmActionBtn';
        newConfirmBtn.onclick = executePendingAction;
        
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.id = 'confirmCancelBtn';
        newCancelBtn.onclick = function() { closeModal('confirmModal'); };
        
        showModal('confirmModal');
    }

    function showNotificationModal(title, message, type) {
        const icon = document.getElementById('notificationIcon');
        const iconTitle = document.getElementById('notificationTitle');
        
        if (type === 'success') {
            icon.className = 'fas fa-check-circle';
            icon.style.color = '#00c853';
            iconTitle.innerText = title || 'Успех';
        } else if (type === 'error') {
            icon.className = 'fas fa-times-circle';
            icon.style.color = '#ff4d4d';
            iconTitle.innerText = title || 'Ошибка';
        } else {
            icon.className = 'fas fa-info-circle';
            icon.style.color = 'var(--accent)';
            iconTitle.innerText = title || 'Информация';
        }
        
        document.getElementById('notificationMessage').innerText = message;
        showModal('notificationModal');
        
        setTimeout(() => {
            closeModal('notificationModal');
        }, 3000);
    }

    function openAddPlayerModal() {
        document.getElementById('playerStatic').value = '';
        document.getElementById('playerReason').value = '';
        showModal('addPlayerModal');
    }

    async function addPlayerToSecurity() {
        const playerId = document.getElementById('playerStatic').value.trim();
        const reason = document.getElementById('playerReason').value.trim();
        
        if (!playerId) {
            showNotificationModal('Ошибка', 'Введите статик игрока', 'error');
            return;
        }
        
        if (!/^\d+$/.test(playerId)) {
            showNotificationModal('Ошибка', 'ID игрока должен содержать только цифры', 'error');
            return;
        }
        
        if (!reason) {
            showNotificationModal('Ошибка', 'Введите причину проверки', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/security/alerts/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    suspect: playerId,
                    action: reason,
                    data: 'Ручное добавление'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                closeModal('addPlayerModal');
                document.getElementById('playerStatic').value = '';
                document.getElementById('playerReason').value = '';
                showNotificationModal('Успех', 'Игрок успешно добавлен в список проверок', 'success');
                loadAlerts();
            } else {
                showNotificationModal('Ошибка', data.error || 'Не удалось добавить игрока', 'error');
            }
        } catch (error) {
            console.error('Ошибка добавления:', error);
            showNotificationModal('Ошибка', 'Ошибка сервера при добавлении игрока', 'error');
        }
    }

    async function copyAllStats() {
        try {
            const response = await fetch('/api/security/alerts?status=OPEN');
            const data = await response.json();
            
            if (data.success && data.alerts && data.alerts.length > 0) {
                const statsList = data.alerts.map(alert => alert.suspect).join('\n');
                
                const textarea = document.createElement('textarea');
                textarea.value = statsList;
                textarea.style.position = 'fixed';
                textarea.style.top = '-9999px';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                textarea.setSelectionRange(0, textarea.value.length);
                
                let success = false;
                try {
                    success = document.execCommand('copy');
                } catch (err) {
                    console.error('execCommand failed:', err);
                }
                
                document.body.removeChild(textarea);
                
                if (!success) {
                    try {
                        await navigator.clipboard.writeText(statsList);
                        success = true;
                    } catch (clipError) {
                        console.error('clipboard API failed:', clipError);
                    }
                }
                
                if (success) {
                    showNotificationModal('Успех', `Скопировано ${data.alerts.length} статиков`, 'success');
                } else {
                    showManualCopyModal(statsList, data.alerts.length);
                }
            } else {
                showNotificationModal('Информация', 'Нет открытых алертов для копирования', 'info');
            }
        } catch (error) {
            console.error('Ошибка копирования:', error);
            showNotificationModal('Ошибка', 'Не удалось скопировать статики', 'error');
        }
    }

    function showManualCopyModal(text, count) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="background: var(--bg-card); padding: 2rem; border-radius: 16px; width: 500px; max-width: 90%;">
                <h3 style="margin-bottom: 1rem; color: var(--accent);">Скопировать статики (${count} шт.)</h3>
                <textarea id="manualCopyText" readonly style="width: 100%; height: 200px; background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main); padding: 0.75rem; border-radius: 8px; font-family: monospace; resize: vertical; margin-bottom: 1rem;">${escapeHtml(text)}</textarea>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-primary" onclick="SecurityModule.selectAndCopyManual()" style="flex: 1;">Выделить и копировать</button>
                    <button class="btn-secondary" onclick="SecurityModule.closeManualCopyModal()" style="flex: 1;">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal._manualModal = true;
        
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        };
    }

    function selectAndCopyManual() {
        const textarea = document.getElementById('manualCopyText');
        if (textarea) {
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            try {
                document.execCommand('copy');
                showNotificationModal('Успех', 'Статики скопированы в буфер обмена', 'success');
                closeManualCopyModal();
            } catch (err) {
                showNotificationModal('Ошибка', 'Не удалось скопировать, скопируйте вручную', 'error');
            }
        }
    }

    function closeManualCopyModal() {
        const modal = document.querySelector('.modal[style*="display: flex"]');
        if (modal && modal._manualModal) {
            modal.remove();
        }
    }

    function showTab(event, tab) {
        const tabs = document.querySelectorAll('.tab-content');
        tabs.forEach(t => t.classList.remove('active'));
        
        const btns = document.querySelectorAll('.tab-btn');
        btns.forEach(b => b.classList.remove('active'));
        
        document.getElementById(tab + 'Tab').classList.add('active');
        event.target.classList.add('active');
        
        if (tab === 'alerts') {
            loadAlerts();
        } else if (tab === 'logs') {
            loadLogs();
        }
    }

    return {
        loadAlerts,
        loadLogs,
        showFullData,
        confirmCloseAlert,
        confirmReopenAlert,
        executePendingAction,
        showTab,
        openAddPlayerModal,
        addPlayerToSecurity,
        copyAllStats,
        selectAndCopyManual,
        closeManualCopyModal,
        showModal,
        closeModal
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    SecurityModule.loadAlerts();
    
    window.showTab = SecurityModule.showTab;
    window.loadAlerts = SecurityModule.loadAlerts;
    window.copyAllStats = SecurityModule.copyAllStats;
    window.openAddPlayerModal = SecurityModule.openAddPlayerModal;
    window.addPlayerToSecurity = SecurityModule.addPlayerToSecurity;
    window.closeModal = SecurityModule.closeModal;
    window.showFullData = SecurityModule.showFullData;
    window.confirmCloseAlert = SecurityModule.confirmCloseAlert;
    window.confirmReopenAlert = SecurityModule.confirmReopenAlert;
    window.selectAndCopyManual = SecurityModule.selectAndCopyManual;
    window.closeManualCopyModal = SecurityModule.closeManualCopyModal;
});