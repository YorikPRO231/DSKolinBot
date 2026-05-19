const FormsModule = (function() {
    let pendingDeleteId = null;
    const channelInfoCache = {};
    const roleCache = {};
    const guildCache = {};

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

    async function getChannelInfo(channelId) {
        if (!channelId) return null;
        if (channelInfoCache[channelId]) return channelInfoCache[channelId];
        
        try {
            const res = await fetch('/api/discord/channel/' + channelId + '/info');
            const data = await res.json();
            if (data.success) {
                channelInfoCache[channelId] = data;
                return data;
            }
        } catch (error) {
            console.error('Ошибка получения информации о канале:', error);
        }
        
        return null;
    }

    async function getGuildName(guildId) {
        if (!guildId) return '—';
        if (guildCache[guildId]) return guildCache[guildId];
        
        try {
            const res = await fetch('/api/discord/guild/' + guildId + '/name');
            const data = await res.json();
            if (data.success) {
                guildCache[guildId] = data.name;
                return data.name;
            }
        } catch (error) {
            console.error('Ошибка получения названия сервера:', error);
        }
        
        return guildId;
    }

    async function getRoleName(guildId, roleId) {
        if (!roleId || !guildId) return '—';
        const cacheKey = guildId + '_' + roleId;
        if (roleCache[cacheKey]) return roleCache[cacheKey];
        
        try {
            const res = await fetch('/api/discord/role/' + guildId + '/' + roleId + '/name');
            const data = await res.json();
            if (data.success) {
                roleCache[cacheKey] = data.name;
                return data.name;
            }
        } catch (error) {
            console.error('Ошибка получения названия роли:', error);
        }
        
        return roleId;
    }

    async function updateRolesCell(index, guildId, roleId1, roleId2) {
        const cell = document.getElementById('roles-' + index);
        if (!cell || !guildId) return;
        
        let rolesHtml = '';
        
        if (roleId1) {
            const name1 = await getRoleName(guildId, roleId1);
            rolesHtml += '<div class="name-cell"><span class="name-text">@' + escapeHtml(name1) + '</span><span class="id-badge" title="ID роли">' + escapeHtml(roleId1) + '</span></div>';
        }
        
        if (roleId2) {
            const name2 = await getRoleName(guildId, roleId2);
            rolesHtml += '<div class="name-cell" style="margin-top: 4px;"><span class="name-text">@' + escapeHtml(name2) + '</span><span class="id-badge" title="ID роли">' + escapeHtml(roleId2) + '</span></div>';
        }
        
        if (rolesHtml) {
            cell.innerHTML = rolesHtml;
        } else {
            cell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
        }
    }

    async function loadForms() {
        try {
            const res = await fetch('/api/forms');
            
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            
            const data = await res.json();
            const list = document.getElementById('formsList');
            
            let bindings = null;
            
            if (data.bindings && Array.isArray(data.bindings)) {
                bindings = data.bindings;
            } else if (data.data && Array.isArray(data.data)) {
                bindings = data.data;
            } else if (Array.isArray(data)) {
                bindings = data;
            } else if (data.success && data.bindings) {
                bindings = data.bindings;
            }
            
            if (bindings && bindings.length > 0) {
                let html = '';
                for (let i = 0; i < bindings.length; i++) {
                    const f = bindings[i];
                    
                    const formId = f.formId || f.id || '—';
                    const channelId = f.channelId || f.channel_id || '—';
                    const guildId = f.guildId || f.guild_id || '—';
                    const formName = f.formName || f.name || '—';
                    const pingRoleId = f.pingRoleId || f.ping_role_id || null;
                    const pingRoleId2 = f.pingRoleId2 || null;
                    
                    let formIdDisplay = String(formId);
                    if (formIdDisplay.length > 35) {
                        formIdDisplay = formIdDisplay.substring(0, 32) + '...';
                    }
                    
                    const escapedFormId = String(formId).replace(/'/g, "\\'");
                    const escapedFormName = String(formName).replace(/'/g, "\\'");
                    
                    html += '<tr id="row-' + i + '">' +
                        '<td><code title="' + escapeHtml(String(formId)) + '">' + escapeHtml(formIdDisplay) + '</code></td>' +
                        '<td id="guild-' + i + '"><span class="loading-name">Загрузка...</span></td>' +
                        '<td id="channel-' + i + '"><span class="loading-name">Загрузка...</span></td>' +
                        '<td>' + escapeHtml(String(formName)) + '</td>' +
                        '<td id="roles-' + i + '"><span class="loading-name">Загрузка...</span></td>' +
                        '<td><button class="delete-btn" onclick="FormsModule.confirmDelete(\'' + escapedFormId + '\', \'' + escapedFormName + '\')" title="Удалить"><i class="fas fa-trash"></i></button></td>' +
                    '</tr>';
                }
                list.innerHTML = html;
                
                for (let i = 0; i < bindings.length; i++) {
                    const f = bindings[i];
                    const channelId = f.channelId || f.channel_id || '—';
                    const guildId = f.guildId || f.guild_id || '—';
                    const pingRoleId = f.pingRoleId || f.ping_role_id || null;
                    const pingRoleId2 = f.pingRoleId2 || null;
                    
                    const guildCell = document.getElementById('guild-' + i);
                    if (guildCell && guildId && guildId !== '—') {
                        getGuildName(guildId).then(name => {
                            guildCell.innerHTML = '<div class="name-cell"><span class="name-text">' + escapeHtml(name) + '</span><span class="id-badge" title="ID сервера">' + escapeHtml(String(guildId)) + '</span></div>';
                        });
                    } else if (guildCell) {
                        guildCell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
                    }
                    
                    const channelCell = document.getElementById('channel-' + i);
                    if (channelCell && channelId && channelId !== '—') {
                        getChannelInfo(channelId).then(info => {
                            if (info && info.channel) {
                                channelCell.innerHTML = '<div class="name-cell"><span class="name-text">#' + escapeHtml(info.channel.name) + '</span><span class="id-badge" title="ID канала">' + escapeHtml(String(channelId)) + '</span></div>';
                            } else {
                                channelCell.innerHTML = '<div class="name-cell"><span class="name-text" style="color: var(--text-dim);">Канал не найден</span><span class="id-badge">' + escapeHtml(String(channelId)) + '</span></div>';
                            }
                        });
                    } else if (channelCell) {
                        channelCell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
                    }
                    
                    const rolesCell = document.getElementById('roles-' + i);
                    if (rolesCell && pingRoleId && guildId && guildId !== '—') {
                        updateRolesCell(i, guildId, pingRoleId, pingRoleId2);
                    } else if (rolesCell) {
                        rolesCell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
                    }
                }
            } else {
                list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-dim);">Формы не найдены</td></tr>';
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            document.getElementById('formsList').innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--danger);">Ошибка загрузки: ' + error.message + '</td></tr>';
        }
    }

    function confirmDelete(formId, formName) {
        pendingDeleteId = formId;
        document.getElementById('deleteFormName').innerHTML = 'Вы уверены, что хотите удалить форму?<br><small style="color: var(--accent);">' + escapeHtml(formName || formId) + '</small>';
        showModal('confirmDeleteModal');
    }

    async function executeDelete() {
        if (!pendingDeleteId) return;
        
        try {
            const res = await fetch('/api/forms/' + encodeURIComponent(pendingDeleteId), { 
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            
            const data = await res.json();
            closeModal('confirmDeleteModal');
            
            if (data.success) {
                showNotificationModal('Успех', 'Форма успешно удалена', 'success');
                loadForms();
            } else {
                showNotificationModal('Ошибка', data.error || 'Не удалось удалить форму', 'error');
            }
        } catch (error) {
            closeModal('confirmDeleteModal');
            showNotificationModal('Ошибка', 'Ошибка сервера: ' + error.message, 'error');
        } finally {
            pendingDeleteId = null;
        }
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
        
        document.getElementById('notificationMessage').innerHTML = message;
        showModal('notificationModal');
        
        setTimeout(() => {
            closeModal('notificationModal');
        }, 3000);
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
            formId: fd.get('formId'),
            channelId: fd.get('channelId'),
            guildId: fd.get('guildId'),
            formName: fd.get('formName') || null,
            pingRoleId: fd.get('pingRoleId') || null,
            pingRoleId2: fd.get('pingRoleId2') || null
        };
        
        try {
            const res = await fetch('/api/forms', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            
            const result = await res.json();
            
            if (result.success) {
                closeModal('addFormModal');
                showNotificationModal('Успех', 'Форма успешно добавлена', 'success');
                loadForms();
                e.target.reset();
            } else {
                showNotificationModal('Ошибка', result.error || 'Не удалось добавить форму', 'error');
            }
        } catch (error) {
            showNotificationModal('Ошибка', 'Ошибка сервера: ' + error.message, 'error');
        }
    }

    return {
        loadForms,
        confirmDelete,
        executeDelete,
        handleFormSubmit,
        showModal,
        closeModal
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    const addForm = document.getElementById('addForm');
    if (addForm) {
        addForm.onsubmit = FormsModule.handleFormSubmit;
    }
    
    const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    if (deleteConfirmBtn) {
        deleteConfirmBtn.onclick = FormsModule.executeDelete;
    }
    
    const deleteCancelBtn = document.getElementById('deleteCancelBtn');
    if (deleteCancelBtn) {
        deleteCancelBtn.onclick = function() { 
            FormsModule.closeModal('confirmDeleteModal');
        };
    }
    
    FormsModule.loadForms();
    
    window.FormsModule = FormsModule;
});