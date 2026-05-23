const FormsModule = (function() {
    let pendingDeleteId = null;
    const channelInfoCache = {};
    const roleCache = {};
    const guildCache = {};

    function showModal(modalId) {
        Utils.showModal(modalId);
    }

    function closeModal(modalId) {
        Utils.closeModal(modalId);
    }

    function extractFormId(input) {
        if (!input) return '';
        const matches = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
        return matches ? matches[1] : input.trim();
    }

    function showSkeletonRow(index) {
        return '<tr id="row-' + index + '">' +
            '<td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 120px;"></div><\/td>' +
            '<td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 150px;"></div><\/td>' +
            '<td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 150px;"></div><\/td>' +
            '<td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 100px;"></div><\/td>' +
            '<td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 120px;"></div><\/td>' +
            '<td class="skeleton-cell"><div class="skeleton skeleton-badge"></div><\/td>' +
        '<\/tr>';
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
            rolesHtml += '<div class="name-cell"><span class="name-text">@' + Utils.escapeHtml(name1) + '</span><span class="id-badge" title="ID роли">' + Utils.escapeHtml(roleId1) + '</span><button class="copy-btn" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(roleId1) + '\')" title="Копировать ID"><i class="fas fa-copy"></i></button></div>';
        }
        
        if (roleId2) {
            const name2 = await getRoleName(guildId, roleId2);
            rolesHtml += '<div class="name-cell" style="margin-top: 4px;"><span class="name-text">@' + Utils.escapeHtml(name2) + '</span><span class="id-badge" title="ID роли">' + Utils.escapeHtml(roleId2) + '</span><button class="copy-btn" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(roleId2) + '\')" title="Копировать ID"><i class="fas fa-copy"></i></button></div>';
        }
        
        cell.innerHTML = rolesHtml || '<span style="color: var(--text-dim);">—</span>';
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast('ID скопирован в буфер обмена');
        } catch (err) {
            console.error('Ошибка копирования:', err);
            Utils.showToast('Не удалось скопировать', true);
        }
    }

    async function loadForms() {
        const list = document.getElementById('formsList');
        list.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            list.innerHTML += showSkeletonRow(i);
        }
        
        try {
            const res = await fetch('/api/forms');
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            
            const data = await res.json();
            let bindings = data.bindings || data.data || data;
            if (data.success && data.bindings) bindings = data.bindings;
            
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
                        '<td><code title="' + Utils.escapeHtml(String(formId)) + '">' + Utils.escapeHtml(formIdDisplay) + '</code><button class="copy-btn" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(String(formId)) + '\')" title="Копировать ID" style="margin-left: 8px;"><i class="fas fa-copy"></i></button><\/td>' +
                        '<td id="guild-' + i + '"><span class="loading-name">Загрузка...</span><\/td>' +
                        '<td id="channel-' + i + '"><span class="loading-name">Загрузка...</span><\/td>' +
                        '<td>' + Utils.escapeHtml(String(formName)) + '<\/td>' +
                        '<td id="roles-' + i + '"><span class="loading-name">Загрузка...</span><\/td>' +
                        '<td><button class="delete-btn" onclick="FormsModule.confirmDelete(\'' + escapedFormId + '\', \'' + escapedFormName + '\')" title="Удалить"><i class="fas fa-trash"></i></button><\/td>' +
                    '<\/tr>';
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
                            guildCell.innerHTML = '<div class="name-cell"><span class="name-text">' + Utils.escapeHtml(name) + '</span><span class="id-badge" title="ID сервера">' + Utils.escapeHtml(String(guildId)) + '</span><button class="copy-btn" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(String(guildId)) + '\')" title="Копировать ID"><i class="fas fa-copy"></i></button></div>';
                        });
                    } else if (guildCell) {
                        guildCell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
                    }
                    
                    const channelCell = document.getElementById('channel-' + i);
                    if (channelCell && channelId && channelId !== '—') {
                        getChannelInfo(channelId).then(info => {
                            if (info && info.channel) {
                                channelCell.innerHTML = '<div class="name-cell"><span class="name-text">#' + Utils.escapeHtml(info.channel.name) + '</span><span class="id-badge" title="ID канала">' + Utils.escapeHtml(String(channelId)) + '</span><button class="copy-btn" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(String(channelId)) + '\')" title="Копировать ID"><i class="fas fa-copy"></i></button></div>';
                            } else {
                                channelCell.innerHTML = '<div class="name-cell"><span class="name-text" style="color: var(--text-dim);">Канал не найден</span><span class="id-badge">' + Utils.escapeHtml(String(channelId)) + '</span></div>';
                            }
                        });
                    } else if (channelCell) {
                        channelCell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
                    }
                    
                    const rolesCell = document.getElementById('roles-' + i);
                    if (rolesCell && (pingRoleId || pingRoleId2) && guildId && guildId !== '—') {
                        updateRolesCell(i, guildId, pingRoleId, pingRoleId2);
                    } else if (rolesCell) {
                        rolesCell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
                    }
                }
            } else {
                list.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-link"></i><p>Формы не найдены</p><button class="btn btn-primary" onclick="FormsModule.showModal(\'addFormModal\')"><i class="fas fa-plus"></i> Добавить первую форму</button><\/td><\/tr>';
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            list.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i><p>Ошибка загрузки: ' + error.message + '</p><button class="btn btn-primary" onclick="FormsModule.loadForms()"><i class="fas fa-sync-alt"></i> Попробовать снова</button><\/td><\/tr>';
        }
    }

    function confirmDelete(formId, formName) {
        pendingDeleteId = formId;
        document.getElementById('deleteFormName').innerHTML = 'Вы уверены, что хотите удалить интеграцию?<br><small style="color: #ff9f43; display: block; margin-top: 8px;">' + Utils.escapeHtml(formName || formId) + '</small>';
        showModal('confirmDeleteModal');
    }

    async function executeDelete() {
        if (!pendingDeleteId) return;
        
        const deleteBtn = document.getElementById('deleteConfirmBtn');
        const originalText = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Удаление...';
        deleteBtn.disabled = true;
        
        try {
            const res = await fetch('/api/forms/' + encodeURIComponent(pendingDeleteId), { 
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            closeModal('confirmDeleteModal');
            
            if (data.success) {
                Utils.showToast('Интеграция успешно удалена');
                loadForms();
            } else {
                Utils.showToast(data.error || 'Не удалось удалить интеграцию', true);
            }
        } catch (error) {
            closeModal('confirmDeleteModal');
            Utils.showToast('Ошибка сервера: ' + error.message, true);
        } finally {
            pendingDeleteId = null;
            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = false;
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
        submitBtn.disabled = true;
        
        const fd = new FormData(e.target);
        
        const rawFormId = fd.get('formId');
        const cleanFormId = extractFormId(rawFormId);
        
        const data = {
            formId: cleanFormId,
            channelId: fd.get('channelId').trim(),
            guildId: fd.get('guildId').trim(),
            formName: fd.get('formName') || null,
            pingRoleId: fd.get('pingRoleId') || null,
            pingRoleId2: fd.get('pingRoleId2') || null
        };
        
        try {
            const res = await fetch('/api/forms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const result = await res.json();
            
            if (result.success) {
                closeModal('addFormModal');
                Utils.showToast('Интеграция успешно добавлена');
                loadForms();
                e.target.reset();
            } else {
                Utils.showToast(result.error || 'Не удалось добавить интеграцию', true);
            }
        } catch (error) {
            Utils.showToast('Ошибка сервера: ' + error.message, true);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    return {
        loadForms,
        confirmDelete,
        executeDelete,
        handleFormSubmit,
        showModal,
        closeModal,
        copyToClipboard
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    const addForm = document.getElementById('addForm');
    if (addForm) addForm.onsubmit = FormsModule.handleFormSubmit;
    
    const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    if (deleteConfirmBtn) deleteConfirmBtn.onclick = FormsModule.executeDelete;
    
    const deleteCancelBtn = document.getElementById('deleteCancelBtn');
    if (deleteCancelBtn) {
        deleteCancelBtn.onclick = function() { 
            FormsModule.closeModal('confirmDeleteModal');
        };
    }
    
    FormsModule.loadForms();
    window.FormsModule = FormsModule;
});