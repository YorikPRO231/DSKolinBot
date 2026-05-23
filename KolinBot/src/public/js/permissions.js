const PermissionsModule = (function() {
    let pendingConfirmAction = null;
    const nicknameCache = {};
    const avatarCache = {};
    let toastTimeout = null;
    let currentRoleDropdownOpen = false;

    function showTab(event, tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        if (event && event.target) {
            event.target.classList.add('active');
        } else {
            const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
            if (btn) btn.classList.add('active');
        }
        
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
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            const nickname = data.nickname || userId;
            nicknameCache[userId] = nickname;
            return nickname;
        } catch (error) {
            console.error(`Ошибка получения никнейма для ${userId}:`, error);
            return userId;
        }
    }

    async function fetchUserAvatar(userId) {
        if (avatarCache[userId]) return avatarCache[userId];
        try {
            const response = await fetch(`/api/discord/user/avatar/${userId}`);
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            const avatarUrl = data.success && data.avatarUrl ? data.avatarUrl : null;
            avatarCache[userId] = avatarUrl;
            return avatarUrl;
        } catch (error) {
            console.error(`Ошибка получения аватара для ${userId}:`, error);
            return null;
        }
    }

    function toggleRoleDropdown() {
        const dropdown = document.getElementById('userRoleDropdown');
        if (!dropdown) return;
        
        currentRoleDropdownOpen = !currentRoleDropdownOpen;
        if (currentRoleDropdownOpen) {
            dropdown.classList.add('open');
        } else {
            dropdown.classList.remove('open');
        }
    }

    function closeRoleDropdown() {
        const dropdown = document.getElementById('userRoleDropdown');
        if (dropdown) {
            dropdown.classList.remove('open');
            currentRoleDropdownOpen = false;
        }
    }

    function selectRoleItem(element) {
        const value = element.getAttribute('data-value');
        const name = element.getAttribute('data-name');
        
        const triggerSpan = document.getElementById('userRoleSelectedValue');
        if (triggerSpan) {
            triggerSpan.textContent = name;
        }
        
        const hiddenSelect = document.getElementById('selectedRoleId');
        if (!hiddenSelect) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.id = 'selectedRoleId';
            input.value = value;
            document.querySelector('.filter-bar').appendChild(input);
        } else {
            hiddenSelect.value = value;
        }
        
        document.querySelectorAll('.dropdown-item-perm').forEach(item => {
            item.classList.remove('active');
        });
        element.classList.add('active');
        
        closeRoleDropdown();
    }

    function getSelectedRoleId() {
        const hiddenSelect = document.getElementById('selectedRoleId');
        if (hiddenSelect && hiddenSelect.value) {
            return hiddenSelect.value;
        }
        const triggerSpan = document.getElementById('userRoleSelectedValue');
        if (triggerSpan && triggerSpan.textContent !== 'Выберите роль') {
            const activeItem = document.querySelector('.dropdown-item-perm.active');
            if (activeItem) {
                return activeItem.getAttribute('data-value');
            }
        }
        return '';
    }

    async function loadUsers() {
        const tbody = document.getElementById('usersList');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="4" class="loading-text"><i class="fas fa-spinner fa-spin"></i> Сбор информации о пользователях...<\/td></tr>`;

        try {
            const response = await fetch('/admin/permissions/api/users');
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            
            if (data.success && data.users && data.users.length > 0) {
                for (const user of data.users) {
                    user.nickname = await fetchUserNickname(user.user_id);
                    user.avatarUrl = await fetchUserAvatar(user.user_id);
                }
                renderUsers(data.users);
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-text"><i class="fas fa-user-slash"></i> Пользователи с назначенными правами отсутствуют<\/td></tr>';
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            tbody.innerHTML = '<tr><td colspan="4" class="error-text"><i class="fas fa-exclamation-circle"></i> Не удалось загрузить список пользователей<\/td></tr>';
        }
    }

    function renderUsers(users) {
        const tbody = document.getElementById('usersList');
        if (!tbody) return;

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-text"><i class="fas fa-user-slash"></i> Пользователи с назначенными правами отсутствуют<\/td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => {
            const avatarHtml = user.avatarUrl 
                ? `<img src="${Utils.escapeHtml(user.avatarUrl)}" class="user-avatar-img" alt="avatar">`
                : `<div class="user-avatar">${(user.nickname && user.nickname !== user.user_id) ? user.nickname.charAt(0).toUpperCase() : 'U'}</div>`;
                
            const rolesHtml = (user.roles || []).map(role => `
                <span class="user-role-badge">
                    ${Utils.escapeHtml(role.role_name || role.role_id)}
                    <button onclick="PermissionsModule.removeUserFromRole('${Utils.escapeHtml(user.user_id)}', '${Utils.escapeHtml(role.role_id)}')" title="Отозвать роль">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `).join('');

            return `
                <tr>
                    <td>
                        <div class="user-info-cell">
                            ${avatarHtml}
                            <div>
                                <div class="user-nickname">${Utils.escapeHtml(user.nickname)}</div>
                                <div class="user-id-small">${Utils.escapeHtml(user.user_id)}</div>
                            </div>
                        </div>
                    <\/td>
                    <td><code>${Utils.escapeHtml(user.user_id)}</code></td>
                    <td>
                        <div class="user-roles">
                            ${rolesHtml || '<span class="user-role-badge" style="background: rgba(255,255,255,0.05); color: var(--text-dim);">Нет ролей</span>'}
                        </div>
                    <\/td>
                    <td style="text-align: center;">
                        <button class="btn-icon" onclick="PermissionsModule.openAddRoleToUserModal('${Utils.escapeHtml(user.user_id)}')" title="Привязать новую роль">
                            <i class="fas fa-plus"></i>
                        </button>
                    <\/td>
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
        
        if (switchBlock) switchBlock.style.opacity = '0.6';
        
        try {
            const response = await fetch(`/admin/permissions/api/roles/${roleId}/permissions/${permissionKey}`, {
                method: isChecked ? 'POST' : 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Network response failure');
            }
            
            Utils.showToast(isChecked ? 'Право успешно добавлено' : 'Право отозвано');
        } catch (error) {
            console.error(error);
            Utils.showToast(error.message || 'Ошибка изменения прав доступа', true);
            checkbox.checked = !isChecked;
            if (switchBlock) {
                if (!isChecked) switchBlock.classList.add('is-active');
                else switchBlock.classList.remove('is-active');
            }
        } finally {
            if (switchBlock) switchBlock.style.opacity = '';
        }
    }

    async function createRole() {
        const roleId = document.getElementById('newRoleId').value.trim();
        const roleName = document.getElementById('newRoleName').value.trim();
        
        if (!roleId || !roleName) {
            Utils.showToast('Пожалуйста, заполните все поля', true);
            return;
        }
        
        if (!/^\d{17,19}$/.test(roleId)) {
            Utils.showToast('ID роли должен быть числом из 17-19 цифр (Discord Role ID)', true);
            return;
        }
        
        try {
            const response = await fetch('/admin/permissions/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId, roleName })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                Utils.showToast('Роль успешно создана. Обновление...');
                closeCreateRoleModal();
                setTimeout(() => location.reload(), 1200);
            } else {
                Utils.showToast(data.error || 'Не удалось создать роль (проверьте уникальность ID)', true);
            }
        } catch (error) {
            console.error(error);
            Utils.showToast('Системная ошибка сети при создании роли', true);
        }
    }

    async function deleteRole(roleId, roleName) {
        openConfirmModal(`Вы действительно хотите безвозвратно удалить административную роль <strong>"${Utils.escapeHtml(roleName)}"</strong>?`, async () => {
            try {
                const response = await fetch(`/admin/permissions/api/roles/${roleId}`, { method: 'DELETE' });
                const data = await response.json();
                
                if (response.ok && data.success) {
                    Utils.showToast('Административная роль удалена');
                    setTimeout(() => location.reload(), 1200);
                } else {
                    Utils.showToast(data.error || 'Ошибка удаления роли на сервере', true);
                }
            } catch (error) {
                console.error(error);
                Utils.showToast('Ошибка соединения с базой', true);
            }
        });
    }

    async function addUserToRole() {
        const userIdInput = document.getElementById('userIdInput');
        const roleId = getSelectedRoleId();
        
        const userId = userIdInput.value.trim();
        
        if (!userId) {
            Utils.showToast('Введите Discord ID пользователя', true);
            return;
        }
        
        if (!roleId) {
            Utils.showToast('Выберите роль из выпадающего списка', true);
            return;
        }
        
        if (!/^\d{17,19}$/.test(userId)) {
            Utils.showToast('Discord ID должен быть числом из 17-19 цифр', true);
            return;
        }
        
        try {
            const response = await fetch('/admin/permissions/api/users/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, roleId })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                Utils.showToast('Пользователю успешно присвоена роль');
                userIdInput.value = '';
                const triggerSpan = document.getElementById('userRoleSelectedValue');
                if (triggerSpan) {
                    triggerSpan.textContent = 'Выберите роль';
                }
                const hiddenSelect = document.getElementById('selectedRoleId');
                if (hiddenSelect) {
                    hiddenSelect.value = '';
                }
                document.querySelectorAll('.dropdown-item-perm').forEach(item => {
                    item.classList.remove('active');
                });
                loadUsers();
            } else {
                Utils.showToast(data.error || 'Ошибка добавления (проверьте существование ID)', true);
            }
        } catch (error) {
            console.error(error);
            Utils.showToast('Сбой отправки запроса', true);
        }
    }

    async function removeUserFromRole(userId, roleId) {
        openConfirmModal(`Отозвать роль у пользователя с Discord ID <code>${Utils.escapeHtml(userId)}</code>?`, async () => {
            try {
                const response = await fetch(`/admin/permissions/api/users/${userId}/roles/${roleId}`, { method: 'DELETE' });
                const data = await response.json();
                
                if (response.ok && data.success) {
                    Utils.showToast('Роль снята с пользователя');
                    loadUsers();
                } else {
                    Utils.showToast(data.error || 'Не удалось забрать роль', true);
                }
            } catch (error) {
                console.error(error);
                Utils.showToast('Сетевой сбой выполнения операции', true);
            }
        });
    }

    function openAddRoleToUserModal(userId) {
        const input = document.getElementById('userIdInput');
        if (input) {
            input.value = userId;
            input.focus();
        }
        
        const usersTab = document.getElementById('usersTab');
        if (usersTab && !usersTab.classList.contains('active')) {
            const usersBtn = document.querySelector('.tab-btn[onclick*="users"]');
            if (usersBtn) {
                showTab({ target: usersBtn }, 'users');
            }
        }
        
        Utils.showToast(`ID скопирован в форму. Выберите назначаемую роль`);
    }

    function openCreateRoleModal() {
        const m = document.getElementById('createRoleModal');
        if (m) m.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('newRoleId')?.focus(), 100);
    }

    function closeCreateRoleModal() {
        const m = document.getElementById('createRoleModal');
        if (m) m.style.display = 'none';
        document.body.style.overflow = '';
        const idInput = document.getElementById('newRoleId');
        const nameInput = document.getElementById('newRoleName');
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
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
            const action = pendingConfirmAction;
            pendingConfirmAction = null;
            action();
            closeConfirmModal();
        }
    }

    function init() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes('roles')) {
                btn.setAttribute('data-tab', 'roles');
            } else if (onclickAttr && onclickAttr.includes('users')) {
                btn.setAttribute('data-tab', 'users');
            }
        });
        
        initGlobalListeners();
        initRoleDropdown();
        
        const usersTab = document.getElementById('usersTab');
        if (usersTab && usersTab.classList.contains('active')) {
            loadUsers();
        }
    }

    function initRoleDropdown() {
        const dropdown = document.getElementById('userRoleDropdown');
        if (!dropdown) return;
        
        const items = document.querySelectorAll('.dropdown-item-perm');
        items.forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                selectRoleItem(this);
            });
        });
    }

    function initGlobalListeners() {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeCreateRoleModal();
                closeConfirmModal();
                closeRoleDropdown();
                const notificationModal = document.getElementById('notificationModal');
                if (notificationModal) notificationModal.style.display = 'none';
            }
        });

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-blur-overlay')) {
                closeCreateRoleModal();
                closeConfirmModal();
                const notificationModal = document.getElementById('notificationModal');
                if (notificationModal) notificationModal.style.display = 'none';
            }
            
            const dropdown = document.getElementById('userRoleDropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                closeRoleDropdown();
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
        toggleRoleDropdown,
        selectRoleItem,
        initGlobalListeners,
        init
    };
})();

window.PermissionsModule = PermissionsModule;
window.showTab = (event, tabName) => PermissionsModule.showTab(event, tabName);
window.togglePermission = (checkbox, roleId, permKey) => PermissionsModule.togglePermission(checkbox, roleId, permKey);
window.createRole = () => PermissionsModule.createRole();
window.deleteRole = (roleId, roleName) => PermissionsModule.deleteRole(roleId, roleName);
window.addUserToRole = () => PermissionsModule.addUserToRole();
window.removeUserFromRole = (userId, roleId) => PermissionsModule.removeUserFromRole(userId, roleId);
window.openAddRoleToUserModal = (userId) => PermissionsModule.openAddRoleToUserModal(userId);
window.openCreateRoleModal = () => PermissionsModule.openCreateRoleModal();
window.closeCreateRoleModal = () => PermissionsModule.closeCreateRoleModal();
window.closeConfirmModal = () => PermissionsModule.closeConfirmModal();
window.executeConfirm = () => PermissionsModule.executeConfirm();
window.toggleRoleDropdown = () => PermissionsModule.toggleRoleDropdown();

document.addEventListener('DOMContentLoaded', function() {
    PermissionsModule.init();
});