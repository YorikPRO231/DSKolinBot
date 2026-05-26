const PermissionsModule = (function() {
    let pendingConfirmAction = null;
    const nicknameCache = {};
    let toastTimeout = null;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function showTab(event, tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const activeTab = document.getElementById(tabName + 'Tab');
        if (activeTab) activeTab.classList.add('active');
        
        if (tabName === 'users') {
            loadUsers();
        }
    }

    async function fetchUserNickname(userId) {
        if (nicknameCache[userId]) return nicknameCache[userId];
        try {
            const response = await fetch(`/api/discord/user/nickname/${userId}`);
            const data = await response.json();
            const nickname = data.nickname || userId;
            nicknameCache[userId] = nickname;
            return nickname;
        } catch (error) {
            console.error(`Ошибка получения никнейма для ${userId}:`, error);
            return userId; 
        }
    }

    async function loadUsers() {
        const tbody = document.getElementById('usersList');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="4" class="loading-text"><i class="fas fa-spinner fa-spin"></i> Сбор информации о пользователях...</td></tr>`;

        try {
            const response = await fetch('/admin/permissions/api/users');
            const data = await response.json();
            
            if (data.success && data.users && data.users.length > 0) {
                await Promise.all(data.users.map(async (user) => {
                    user.nickname = await fetchUserNickname(user.user_id);
                }));
                renderUsers(data.users);
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-text"><i class="fas fa-user-slash"></i> Пользователи с назначенными правами отсутствуют</td></tr>';
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            tbody.innerHTML = '<tr><td colspan="4" class="error-text"><i class="fas fa-exclamation-circle" style="color:var(--danger)"></i> Не удалось загрузить список пользователей</td></tr>';
        }
    }

    function renderUsers(users) {
        const tbody = document.getElementById('usersList');
        if (!tbody) return;

        tbody.innerHTML = users.map(user => {
            const avatarLetter = (user.nickname && user.nickname !== user.user_id) 
                ? user.nickname.charAt(0).toUpperCase() 
                : 'U';
                
            const rolesHtml = user.roles.map(role => `
                <span class="user-role-badge">
                    ${escapeHtml(role.role_name)}
                    <button onclick="PermissionsModule.removeUserFromRole('${escapeHtml(user.user_id)}', '${escapeHtml(role.role_id)}')" title="Отозвать роль">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `).join('');

            return `
                <tr>
                    <td>
                        <div class="user-info-cell">
                            <div class="user-avatar">${escapeHtml(avatarLetter)}</div>
                            <div>
                                <div class="user-nickname">${escapeHtml(user.nickname)}</div>
                                <div class="user-id-small">${escapeHtml(user.user_id)}</div>
                            </div>
                        </div>
                    </td>
                    <td><code>${escapeHtml(user.user_id)}</code></td>
                    <td>
                        <div class="user-roles">
                            ${rolesHtml || '<span class="user-role-badge" style="background: rgba(255,255,255,0.05); color: var(--text-dim);">Нет ролей</span>'}
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <button class="btn-icon" onclick="PermissionsModule.openAddRoleToUserModal('${escapeHtml(user.user_id)}')" title="Привязать новую роль">
                            <i class="fas fa-plus"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function togglePermission(checkbox, roleId, permissionKey) {
        const isChecked = checkbox.checked;
        const switchBlock = checkbox.closest('.permission-switch-block');
        
        if (switchBlock) {
            if (isChecked) switchBlock.classList.add('is-active');
            else switchBlock.classList.remove('is-active');
        }
        
        try {
            const response = await fetch(`/admin/permissions/api/roles/${roleId}/permissions/${permissionKey}`, {
                method: isChecked ? 'POST' : 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) throw new Error('Network response failure');
            openNotificationModal(isChecked ? 'Право успешно добавлено' : 'Право отозвано');
        } catch (error) {
            console.error(error);
            openNotificationModal('Ошибка изменения прав доступа', true);
            checkbox.checked = !isChecked;
            if (switchBlock) {
                if (!isChecked) switchBlock.classList.add('is-active');
                else switchBlock.classList.remove('is-active');
            }
        }
    }

    async function createRole() {
        const roleId = document.getElementById('newRoleId').value.trim();
        const roleName = document.getElementById('newRoleName').value.trim();
        
        if (!roleId || !roleName) {
            openNotificationModal('Пожалуйста, заполните все поля', true);
            return;
        }
        
        try {
            const response = await fetch('/admin/permissions/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId, roleName })
            });
            
            if (response.ok) {
                openNotificationModal('Роль успешно создана. Обновление...');
                closeCreateRoleModal();
                setTimeout(() => location.reload(), 1200);
            } else {
                openNotificationModal('Не удалось создать роль (проверьте уникальность ID)', true);
            }
        } catch (error) {
            openNotificationModal('Системная ошибка сети при создании роли', true);
        }
    }

    async function deleteRole(roleId, roleName) {
        openConfirmModal(`Вы действительно хотите безвозвратно удалить административную роль <strong>"${escapeHtml(roleName)}"</strong>?`, async () => {
            try {
                const response = await fetch(`/admin/permissions/api/roles/${roleId}`, { method: 'DELETE' });
                if (response.ok) {
                    openNotificationModal('Административная роль удалена');
                    setTimeout(() => location.reload(), 1200);
                } else {
                    openNotificationModal('Ошибка удаления роли на сервере', true);
                }
            } catch (error) {
                openNotificationModal('Ошибка соединения с базой', true);
            }
        });
    }

    async function addUserToRole() {
        const userIdInput = document.getElementById('userIdInput');
        const userRoleSelect = document.getElementById('userRoleSelect');
        
        const userId = userIdInput.value.trim();
        const roleId = userRoleSelect.value;
        
        if (!userId || !roleId) {
            openNotificationModal('Укажите Discord ID и выберите роль из выпадающего списка', true);
            return;
        }
        
        try {
            const response = await fetch('/admin/permissions/api/users/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, roleId })
            });
            
            if (response.ok) {
                openNotificationModal('Пользователю успешно присвоена роль');
                userIdInput.value = '';
                userRoleSelect.value = '';
                loadUsers();
            } else {
                openNotificationModal('Ошибка добавления (проверьте существование ID)', true);
            }
        } catch (error) {
            openNotificationModal('Сбой отправки запроса', true);
        }
    }

    async function removeUserFromRole(userId, roleId) {
        openConfirmModal(`Отозвать роль у пользователя с Discord ID <code>${escapeHtml(userId)}</code>?`, async () => {
            try {
                const response = await fetch(`/admin/permissions/api/users/${userId}/roles/${roleId}`, { method: 'DELETE' });
                if (response.ok) {
                    openNotificationModal('Роль снята с пользователя');
                    loadUsers();
                } else {
                    openNotificationModal('Не удалось забрать роль', true);
                }
            } catch (error) {
                openNotificationModal('Сетевой сбой выполнения операции', true);
            }
        });
    }

    function openAddRoleToUserModal(userId) {
        const select = document.getElementById('userRoleSelect');
        const input = document.getElementById('userIdInput');
        if (input) input.value = userId;
        if (select) {
            select.focus();
            openNotificationModal(`ID скопирован в форму. Выберите назначаемую роль ниже`, false);
        }
    }

    function openCreateRoleModal() {
        const m = document.getElementById('createRoleModal');
        if (m) m.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeCreateRoleModal() {
        const m = document.getElementById('createRoleModal');
        if (m) m.style.display = 'none';
        document.body.style.overflow = '';
        document.getElementById('newRoleId').value = '';
        document.getElementById('newRoleName').value = '';
    }

    function openConfirmModal(message, onConfirm) {
        const msg = document.getElementById('confirmMessage');
        const m = document.getElementById('confirmModal');
        if (msg) msg.innerHTML = message;
        pendingConfirmAction = onConfirm;
        if (m) m.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeConfirmModal() {
        const m = document.getElementById('confirmModal');
        if (m) m.style.display = 'none';
        document.body.style.overflow = '';
        pendingConfirmAction = null;
    }

    function executeConfirm() {
        if (pendingConfirmAction) {
            pendingConfirmAction();
            closeConfirmModal();
        }
    }

    function openNotificationModal(message, isError = false) {
        if (toastTimeout) clearTimeout(toastTimeout);

        const modal = document.getElementById('notificationModal');
        const icon = document.getElementById('notificationIcon');
        const title = document.getElementById('notificationTitle');
        const msg = document.getElementById('notificationMessage');
        
        if (!modal || !icon || !title || !msg) return;

        if (isError) {
            icon.className = 'fas fa-exclamation-circle';
            icon.style.color = 'var(--danger)';
            title.textContent = 'Ошибка';
        } else {
            icon.className = 'fas fa-check-circle';
            icon.style.color = 'var(--accent)';
            title.textContent = 'Успешно';
        }
        
        msg.innerHTML = message;
        modal.style.display = 'flex';
        
        toastTimeout = setTimeout(() => closeNotificationModal(), 3000);
    }

    function closeNotificationModal() {
        const modal = document.getElementById('notificationModal');
        if (modal) modal.style.display = 'none';
        if (document.getElementById('createRoleModal').style.display !== 'flex' && 
            document.getElementById('confirmModal').style.display !== 'flex') {
            document.body.style.overflow = '';
        }
    }

    function initGlobalListeners() {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeCreateRoleModal();
                closeConfirmModal();
                closeNotificationModal();
            }
        });

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-blur-overlay')) {
                closeCreateRoleModal();
                closeConfirmModal();
                closeNotificationModal();
            }
        });
    }

    return {
        showTab,
        togglePermission,
        createRole,
        deleteRole,
        addUserToRole,
        removeUserFromRole,
        openAddRoleToUserModal,
        openCreateRoleModal,
        closeCreateRoleModal,
        closeConfirmModal,
        executeConfirm,
        closeNotificationModal,
        initGlobalListeners
    };
})();

window.PermissionsModule = PermissionsModule;

document.addEventListener('DOMContentLoaded', function() {
    PermissionsModule.initGlobalListeners();
});