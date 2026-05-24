const FormsModule = (function() {
    let pendingDeleteId = null;
    let pendingEditData = null;
    let autoRefreshInterval = null;
    let currentSearchTerm = '';
    let currentFilter = 'all';
    let selectedForms = new Set();
    let allFormsData = [];
    const channelInfoCache = {};
    const roleCache = {};
    const guildCache = {};
    let filterTimeout = null;

    function showModal(modalId) {
        Utils.showModal(modalId);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.setAttribute('aria-hidden', 'false');
            const backdropClick = function(e) {
                if (e.target === modal) closeModal(modalId);
            };
            modal.addEventListener('click', backdropClick, { once: true });
            const escapeHandler = function(e) {
                if (e.key === 'Escape') {
                    closeModal(modalId);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        }
    }

    function closeModal(modalId) {
        Utils.closeModal(modalId);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    function extractFormId(input) {
        if (!input) return '';
        const matches = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
        return matches ? matches[1] : input.trim();
    }

    function validateDiscordId(id) {
        if (!id) return true;
        return /^\d{17,20}$/.test(id.trim());
    }

    function showSkeletonRow(index) {
        return `<tr id="skeleton-${index}">
            <td><div class="custom-pure-checkbox" style="pointer-events: none;"><span class="checkmark"></span></div></td>
            <td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 120px;"></div></td>
            <td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
            <td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
            <td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
            <td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 120px;"></div></td>
            <td class="skeleton-cell"><div class="skeleton skeleton-badge"></div></td>
            <td class="skeleton-cell"><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
        </tr>`;
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
            rolesHtml += '<div class="name-cell"><span class="name-text" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(roleId1) + '\')" title="Нажмите чтобы скопировать ID">@' + Utils.escapeHtml(name1) + '</span><span class="id-badge" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(roleId1) + '\')">' + Utils.escapeHtml(roleId1) + '</span></div>';
        }
        if (roleId2) {
            const name2 = await getRoleName(guildId, roleId2);
            rolesHtml += '<div class="name-cell" style="margin-top: 4px;"><span class="name-text" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(roleId2) + '\')" title="Нажмите чтобы скопировать ID">@' + Utils.escapeHtml(name2) + '</span><span class="id-badge" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(roleId2) + '\')">' + Utils.escapeHtml(roleId2) + '</span></div>';
        }
        cell.innerHTML = rolesHtml || '<span style="color: var(--text-dim);">—</span>';
        performFilter(); 
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast('ID скопирован в буфер обмена', false);
        } catch (err) {
            console.error('Ошибка копирования:', err);
            Utils.showToast('Не удалось скопировать', true);
        }
    }

    function filterForms() {
        if (filterTimeout) {
            clearTimeout(filterTimeout);
        }
        filterTimeout = setTimeout(function() {
            performFilter();
        }, 100);
    }

    function performFilter() {
        const list = document.getElementById('formsList');
        const rows = list.querySelectorAll('tr:not(.empty-filter-message)');
        let visibleCount = 0;
        
        const query = currentSearchTerm.toLowerCase().trim();
        const filterGuildId = currentFilter;

        rows.forEach(function(row) {
            if (row.querySelector('.skeleton') || row.id.startsWith('skeleton-')) return;

            const rowGuildId = row.getAttribute('data-guild-id') || '';
            
            let rowTextContent = '';
            const cells = row.querySelectorAll('td:not(:first-child):not(:last-child)'); 
            
            cells.forEach(cell => {
                if (cell.querySelector('.loading-name')) return;
                
                const mainTexts = cell.querySelectorAll('.name-text, code, .status-badge, .error-msg');
                if (mainTexts.length > 0) {
                    mainTexts.forEach(el => {
                        rowTextContent += ' ' + el.textContent.toLowerCase();
                    });
                } else {
                    rowTextContent += ' ' + cell.textContent.toLowerCase();
                }
            });

            let matchesSearch = true;
            let matchesSelect = true;

            if (query) {
                if (!rowTextContent.includes(query)) {
                    matchesSearch = false;
                }
            }

            if (filterGuildId !== 'all') {
                if (rowGuildId !== filterGuildId) {
                    matchesSelect = false;
                }
            }

            if (matchesSearch && matchesSelect) {
                row.style.display = '';
                row.setAttribute('data-visible', 'true');
                visibleCount++;
            } else {
                row.style.display = 'none';
                row.setAttribute('data-visible', 'false');
            }
        });

        const emptyMessage = list.querySelector('.empty-filter-message');
        if (visibleCount === 0 && rows.length > 0) {
            if (!emptyMessage) {
                const tr = document.createElement('tr');
                tr.className = 'empty-filter-message';
                tr.innerHTML = '<td colspan="8" class="empty-state"><i class="fas fa-filter"></i><p>По вашему фильтру ничего не найдено</p><button class="btn btn-primary" onclick="FormsModule.resetFilters();"><i class="fas fa-undo-alt"></i> Сбросить фильтры</button></td></tr>';
                list.appendChild(tr);
            }
        } else if (emptyMessage && visibleCount > 0) {
            emptyMessage.remove();
        }

        updateSelectAllCheckbox();
    }

    function resetFilters() {
        const searchInput = document.getElementById('searchForms');
        if (searchInput) searchInput.value = '';
        currentSearchTerm = '';
        currentFilter = 'all';
        
        const triggerLabel = document.getElementById('customSelectLabel');
        if (triggerLabel) triggerLabel.innerText = 'Все сервера';
        
        const options = document.querySelectorAll('.custom-option');
        options.forEach(opt => {
            if (opt.getAttribute('data-value') === 'all') opt.classList.add('selected');
            else opt.classList.remove('selected');
        });

        performFilter();
    }

    function updateSelectAllCheckbox() {
        const selectAllInput = document.getElementById('selectAllInput');
        if (!selectAllInput) return;
        const visibleRows = Array.from(document.querySelectorAll('#formsList tr[data-visible="true"]')).filter(function(row) {
            return row.querySelector('td') && !row.querySelector('.skeleton');
        });
        const checkedRows = visibleRows.filter(function(row) {
            const checkbox = row.querySelector('.custom-pure-checkbox');
            return checkbox && checkbox.getAttribute('data-checked') === 'true';
        });
        if (visibleRows.length === 0) {
            selectAllInput.setAttribute('data-checked', 'false');
        } else if (checkedRows.length === visibleRows.length) {
            selectAllInput.setAttribute('data-checked', 'true');
        } else if (checkedRows.length > 0) {
            selectAllInput.setAttribute('data-checked', 'indeterminate');
        } else {
            selectAllInput.setAttribute('data-checked', 'false');
        }
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        if (bulkDeleteBtn) {
            if (selectedForms.size > 0) {
                bulkDeleteBtn.classList.add('visible');
                bulkDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Удалить выбранные (' + selectedForms.size + ')';
            } else {
                bulkDeleteBtn.classList.remove('visible');
            }
        }
    }

    async function updateGuildFilter() {
        const optionsContainer = document.getElementById('customSelectOptions');
        if (!optionsContainer) return;
        
        const uniqueGuilds = new Map();
        for (const form of allFormsData) {
            const guildId = form.guildId || form.guild_id;
            if (guildId && guildId !== '—') {
                let guildName = guildCache[guildId];
                if (!guildName) {
                    guildName = await getGuildName(guildId);
                }
                if (!uniqueGuilds.has(guildId)) {
                    uniqueGuilds.set(guildId, guildName);
                }
            }
        }
        
        let html = `<div class="custom-option ${currentFilter === 'all' ? 'selected' : ''}" data-value="all">Все сервера (${allFormsData.length})</div>`;
        const sortedGuilds = Array.from(uniqueGuilds.entries()).sort(function(a, b) {
            return a[1].localeCompare(b[1]);
        });
        
        for (let i = 0; i < sortedGuilds.length; i++) {
            const guildId = sortedGuilds[i][0];
            const guildName = sortedGuilds[i][1];
            let count = 0;
            for (let j = 0; j < allFormsData.length; j++) {
                if ((allFormsData[j].guildId || allFormsData[j].guild_id) === guildId) {
                    count++;
                }
            }
            const isSelected = currentFilter === guildId;
            html += `<div class="custom-option ${isSelected ? 'selected' : ''}" data-value="${Utils.escapeHtml(guildId)}">${Utils.escapeHtml(guildName)} (${count})</div>`;
            if (isSelected) {
                document.getElementById('customSelectLabel').innerText = `${guildName} (${count})`;
            }
        }
        
        optionsContainer.innerHTML = html;
        
        if (currentFilter === 'all' || !uniqueGuilds.has(currentFilter)) {
            currentFilter = 'all';
            document.getElementById('customSelectLabel').innerText = `Все сервера (${allFormsData.length})`;
        }

        optionsContainer.querySelectorAll('.custom-option').forEach(option => {
            option.onclick = function() {
                optionsContainer.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                this.classList.add('selected');
                currentFilter = this.getAttribute('data-value');
                document.getElementById('customSelectLabel').innerText = this.innerText;
                document.getElementById('customSelectWrapper').classList.remove('open');
                FormsModule.filterForms();
            };
        });
    }

    function toggleSelect(element, formId) {
        const isChecked = element.getAttribute('data-checked') === 'true';
        if (!isChecked) {
            element.setAttribute('data-checked', 'true');
            selectedForms.add(formId);
        } else {
            element.setAttribute('data-checked', 'false');
            selectedForms.delete(formId);
        }
        updateSelectAllCheckbox();
    }

    function selectAllForms() {
        const selectAllInput = document.getElementById('selectAllInput');
        const currentState = selectAllInput.getAttribute('data-checked');
        const visibleRows = Array.from(document.querySelectorAll('#formsList tr[data-visible="true"]')).filter(function(row) {
            return row.querySelector('td') && !row.querySelector('.skeleton');
        });
        
        if (currentState === 'false' || currentState === 'indeterminate') {
            selectAllInput.setAttribute('data-checked', 'true');
            visibleRows.forEach(function(row) {
                const checkbox = row.querySelector('.custom-pure-checkbox');
                if (checkbox) {
                    checkbox.setAttribute('data-checked', 'true');
                    const formId = checkbox.getAttribute('data-form-id');
                    selectedForms.add(formId);
                }
            });
        } else {
            selectAllInput.setAttribute('data-checked', 'false');
            visibleRows.forEach(function(row) {
                const checkbox = row.querySelector('.custom-pure-checkbox');
                if (checkbox) {
                    checkbox.setAttribute('data-checked', 'false');
                    const formId = checkbox.getAttribute('data-form-id');
                    selectedForms.delete(formId);
                }
            });
        }
        updateSelectAllCheckbox();
    }

    async function bulkDelete() {
        if (selectedForms.size === 0) return;
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        const originalText = bulkDeleteBtn.innerHTML;
        bulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Удаление...';
        bulkDeleteBtn.disabled = true;
        if (confirm('Вы уверены, что хотите удалить ' + selectedForms.size + ' интеграцию(й)?')) {
            const deletePromises = Array.from(selectedForms).map(function(formId) {
                return fetch('/api/forms/' + encodeURIComponent(formId), { method: 'DELETE' });
            });
            try {
                const results = await Promise.allSettled(deletePromises);
                let successCount = 0;
                let failCount = 0;
                results.forEach(function(result) {
                    if (result.status === 'fulfilled') {
                        successCount++;
                    } else {
                        failCount++;
                    }
                });
                if (failCount === 0) {
                    Utils.showToast('Удалено ' + successCount + ' интеграций', false);
                } else {
                    Utils.showToast('Удалено ' + successCount + ', ошибок: ' + failCount, true);
                }
                selectedForms.clear();
                loadForms();
            } catch (error) {
                Utils.showToast('Ошибка при массовом удалении', true);
            }
        }
        bulkDeleteBtn.innerHTML = originalText;
        bulkDeleteBtn.disabled = false;
    }

    async function loadForms() {
        const list = document.getElementById('formsList');
        if (list.innerHTML === '' || allFormsData.length === 0) {
            list.innerHTML = '';
            for (let i = 0; i < 5; i++) {
                list.innerHTML += showSkeletonRow(i);
            }
        }
        try {
            const res = await fetch('/api/forms');
            if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);
            const data = await res.json();
            let bindings = data.bindings || data.data || data;
            if (data.success && data.bindings) bindings = data.bindings;
            if (bindings && bindings.length > 0) {
                allFormsData = bindings;
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
                    const isChecked = selectedForms.has(String(formId)) ? 'true' : 'false';
                    
                    html += '<tr id="row-' + i + '" data-guild-id="' + Utils.escapeHtml(String(guildId)) + '" data-visible="true">' +
                        '<td><div class="custom-pure-checkbox" data-form-id="' + Utils.escapeHtml(String(formId)) + '" data-checked="' + isChecked + '" onclick="FormsModule.toggleSelect(this, \'' + Utils.escapeHtml(String(formId)) + '\')"><span class="checkmark"></span></div></td>' +
                        '<td data-label="ID формы"><code title="Нажмите чтобы скопировать ID" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(String(formId)) + '\')">' + Utils.escapeHtml(formIdDisplay) + '</code></td>' +
                        '<td data-label="Сервер" id="guild-' + i + '"><span class="loading-name">Загрузка...</span></td>' +
                        '<td data-label="Канал" id="channel-' + i + '"><span class="loading-name">Загрузка...</span></td>' +
                        '<td data-label="Название">' + Utils.escapeHtml(String(formName)) + '</td>' +
                        '<td data-label="Роли для пинга" id="roles-' + i + '"><span class="loading-name">Загрузка...</span></td>' +
                        '<td data-label="Статус" id="status-' + i + '"><span class="status-badge loading-discord"></span></td>' +
                        '<td data-label="Действия">' +
                            '<button class="edit-btn" onclick="FormsModule.showEditModal(\'' + escapedFormId + '\', \'' + escapedFormName + '\', \'' + Utils.escapeHtml(String(channelId)) + '\', \'' + Utils.escapeHtml(String(guildId)) + '\', \'' + (pingRoleId || '') + '\', \'' + (pingRoleId2 || '') + '\')" title="Редактировать"><i class="fas fa-edit"></i></button>' +
                            '<button class="delete-btn" onclick="FormsModule.confirmDelete(\'' + escapedFormId + '\', \'' + escapedFormName + '\')" title="Удалить"><i class="fas fa-trash"></i></button>' +
                        '</td>' +
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
                        const guildName = await getGuildName(guildId);
                        guildCell.innerHTML = '<div class="name-cell"><span class="name-text" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(String(guildId)) + '\')" title="Нажмите чтобы скопировать ID">' + Utils.escapeHtml(guildName) + '</span><span class="id-badge" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(String(guildId)) + '\')">' + Utils.escapeHtml(String(guildId)) + '</span></div>';
                    } else if (guildCell) {
                        guildCell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
                    }
                    
                    const channelCell = document.getElementById('channel-' + i);
                    const statusSpan = document.getElementById('status-' + i);
                    if (channelCell && channelId && channelId !== '—') {
                        const info = await getChannelInfo(channelId);
                        if (info && info.channel) {
                            channelCell.innerHTML = '<div class="name-cell"><span class="name-text" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(String(channelId)) + '\')" title="Нажмите чтобы скопировать ID">#' + Utils.escapeHtml(info.channel.name) + '</span><span class="id-badge" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(String(channelId)) + '\')">' + Utils.escapeHtml(String(channelId)) + '</span></div>';
                            if (statusSpan) {
                                statusSpan.innerHTML = '<span class="status-badge status-online">Доступен</span>';
                            }
                        } else {
                            channelCell.innerHTML = '<div class="name-cell error-text-cell"><span class="error-msg">Канал не найден</span><span class="id-badge" onclick="FormsModule.copyToClipboard(\'' + Utils.escapeHtml(String(channelId)) + '\')">' + Utils.escapeHtml(String(channelId)) + '</span></div>';
                            if (statusSpan) {
                                statusSpan.innerHTML = '<span class="status-badge status-offline">Недоступен</span>';
                            }
                        }
                    } else if (channelCell) {
                        channelCell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
                        if (statusSpan) {
                            statusSpan.innerHTML = '<span class="status-badge status-offline">Нет канала</span>';
                        }
                    }
                    
                    const rolesCell = document.getElementById('roles-' + i);
                    if (rolesCell && (pingRoleId || pingRoleId2) && guildId && guildId !== '—') {
                        updateRolesCell(i, guildId, pingRoleId, pingRoleId2);
                    } else if (rolesCell) {
                        rolesCell.innerHTML = '<span style="color: var(--text-dim);">—</span>';
                    }
                }
                await updateGuildFilter();
                performFilter();
            } else {
                allFormsData = [];
                list.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-link"></i><p>Формы не найдены</p><button class="btn btn-primary" onclick="FormsModule.showModal(\'addFormModal\')"><i class="fas fa-plus"></i> Добавить первую форму</button></td></tr>';
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            list.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i><p>Ошибка загрузки: ' + error.message + '</p><button class="btn btn-primary" onclick="FormsModule.loadForms()"><i class="fas fa-sync-alt"></i> Попробовать снова</button></td></tr>';
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
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            closeModal('confirmDeleteModal');
            if (data.success) {
                Utils.showToast('Интеграция успешно удалена', false);
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

    function showEditModal(formId, formName, channelId, guildId, pingRoleId, pingRoleId2) {
        pendingEditData = { formId: formId, formName: formName, channelId: channelId, guildId: guildId, pingRoleId: pingRoleId, pingRoleId2: pingRoleId2 };
        document.getElementById('editFormId').value = formId;
        document.getElementById('editFormName').value = formName !== '—' ? formName : '';
        document.getElementById('editChannelId').value = channelId !== '—' ? channelId : '';
        document.getElementById('editGuildId').value = guildId !== '—' ? guildId : '';
        document.getElementById('editPingRoleId').value = pingRoleId || '';
        document.getElementById('editPingRoleId2').value = pingRoleId2 || '';
        showModal('editFormModal');
    }

    async function handleEditSubmit(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        submitBtn.disabled = true;
        e.target.classList.add('loading');
        const fd = new FormData(e.target);
        const data = {
            formId: fd.get('formId').trim(),
            channelId: fd.get('channelId').trim(),
            guildId: fd.get('guildId').trim(),
            formName: fd.get('formName') || null,
            pingRoleId: fd.get('pingRoleId') || null,
            pingRoleId2: fd.get('pingRoleId2') || null
        };
        try {
            const res = await fetch('/api/forms/' + encodeURIComponent(pendingEditData.formId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const result = await res.json();
            if (result.success) {
                closeModal('editFormModal');
                Utils.showToast('Интеграция успешно обновлена', false);
                loadForms();
            } else {
                Utils.showToast(result.error || 'Не удалось обновить интеграцию', true);
            }
        } catch (error) {
            Utils.showToast('Ошибка сервера: ' + error.message, true);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            e.target.classList.remove('loading');
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
        submitBtn.disabled = true;
        e.target.classList.add('loading');
        const fd = new FormData(e.target);
        const rawFormId = fd.get('formId');
        const cleanFormId = extractFormId(rawFormId);
        const channelId = fd.get('channelId').trim();
        const guildId = fd.get('guildId').trim();
        if (!validateDiscordId(channelId) || !validateDiscordId(guildId)) {
            Utils.showToast('Пожалуйста, введите корректные Discord ID (17-20 цифр)', true);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            e.target.classList.remove('loading');
            return;
        }
        const data = {
            formId: cleanFormId,
            channelId: channelId,
            guildId: guildId,
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
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const result = await res.json();
            if (result.success) {
                closeModal('addFormModal');
                Utils.showToast('Интеграция успешно добавлена', false);
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
            e.target.classList.remove('loading');
        }
    }

    function startAutoRefresh() {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        autoRefreshInterval = setInterval(function() {
            if (document.hasFocus()) {
                loadForms();
            }
        }, 30000);
    }

    return {
        loadForms: loadForms,
        confirmDelete: confirmDelete,
        executeDelete: executeDelete,
        handleFormSubmit: handleFormSubmit,
        handleEditSubmit: handleEditSubmit,
        showEditModal: showEditModal,
        showModal: showModal,
        closeModal: closeModal,
        copyToClipboard: copyToClipboard,
        toggleSelect: toggleSelect,
        selectAllForms: selectAllForms,
        bulkDelete: bulkDelete,
        filterForms: filterForms,
        performFilter: performFilter,
        resetFilters: resetFilters,
        startAutoRefresh: startAutoRefresh,
        get currentSearchTerm() {
            return currentSearchTerm;
        },
        set currentSearchTerm(value) {
            currentSearchTerm = value;
        },
        get currentFilter() {
            return currentFilter;
        },
        set currentFilter(value) {
            currentFilter = value;
        }
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    const addForm = document.getElementById('addForm');
    if (addForm) addForm.onsubmit = FormsModule.handleFormSubmit;
    const editForm = document.getElementById('editForm');
    if (editForm) editForm.onsubmit = FormsModule.handleEditSubmit;
    const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    if (deleteConfirmBtn) deleteConfirmBtn.onclick = FormsModule.executeDelete;
    const deleteCancelBtn = document.getElementById('deleteCancelBtn');
    if (deleteCancelBtn) {
        deleteCancelBtn.onclick = function() {
            FormsModule.closeModal('confirmDeleteModal');
        };
    }
    
    const selectAllCheckbox = document.getElementById('selectAllInput');
    if (selectAllCheckbox) {
        selectAllCheckbox.onclick = FormsModule.selectAllForms;
    }
    
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.onclick = FormsModule.bulkDelete;
    }
    
    const searchInput = document.getElementById('searchForms');
    if (searchInput) {
        searchInput.oninput = function(e) {
            FormsModule.currentSearchTerm = e.target.value;
            FormsModule.filterForms();
        };
    }

    const customSelectWrapper = document.getElementById('customSelectWrapper');
    if (customSelectWrapper) {
        customSelectWrapper.querySelector('.custom-select-trigger').onclick = function(e) {
            e.stopPropagation();
            customSelectWrapper.classList.toggle('open');
        };
    }

    document.addEventListener('click', function() {
        if (customSelectWrapper) {
            customSelectWrapper.classList.remove('open');
        }
    });

    FormsModule.loadForms();
    FormsModule.startAutoRefresh();
    window.FormsModule = FormsModule;
});