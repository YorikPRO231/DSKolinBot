const SettingsModule = (function () {
    let settings = {};

    async function init() {
        await loadFromServer();
        renderAll();
        initCustomSelects();
    }

    async function loadFromServer() {
        try {
            const resp = await fetch("/admin/settings/api/settings");
            const data = await resp.json();
            if (data.success) {
                settings = data.settings;
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
    }

    async function saveSettings() {
        saveServersToSettings();

        try {
            const resp = await fetch("/admin/settings/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ settings }),
            });
            const data = await resp.json();
            if (data.success) {
                showToast("Настройки сохранены и применены");
            } else {
                showToast(data.error || "Ошибка сохранения", true);
            }
        } catch (e) {
            showToast("Ошибка соединения", true);
        }
    }

    function showToast(msg, isError) {
        if (typeof Utils !== "undefined" && Utils.showToast) {
            Utils.showToast(msg, isError);
        } else {
            alert(msg);
        }
    }

    function showTab(event, name) {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        event.target.classList.add("active");
        document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
        const tab = document.getElementById("tab-" + name);
        if (tab) tab.classList.add("active");
    }

    function renderAll() {
        renderFactions();
        renderDetectives();
        renderServers();
        renderPositions();
        renderRoles();
        renderChannels();
    }

    function renderFactions() {
        const grid = document.getElementById("factionsGrid");
        if (!grid) return;
        const factions = settings.factions || {};
        grid.innerHTML = Object.entries(factions)
            .map(
                ([key, f]) => `
            <div class="faction-card">
                <div class="faction-card-header">
                    <div>
                        <span class="faction-key">${esc(key)}</span>
                        <span class="faction-badge ${f.type}">${f.type === "government" ? "Гос" : "Крим"}</span>
                    </div>
                    <div class="faction-card-actions">
                        <button class="btn-icon" onclick="SettingsModule.openFactionModal('${esc(key)}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" style="color:#ff3b30;" onclick="SettingsModule.deleteFaction('${esc(key)}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="faction-card-body">
                    <div><strong>${esc(f.label)}</strong></div>
                    <div class="faction-id">Discord: ${esc(f.discord_id)}</div>
                    <div class="faction-id">Emoji: ${esc(f.emoji_id)}</div>
                </div>
            </div>
        `
            )
            .join("");
    }

    function renderDetectives() {
        const grid = document.getElementById("detectivesGrid");
        if (!grid) return;
        const dets = settings.detectives || {};
        grid.innerHTML = Object.entries(dets)
            .map(
                ([key, d]) => `
            <div class="faction-card">
                <div class="faction-card-header">
                    <span class="faction-key">${esc(key)}</span>
                    <div class="faction-card-actions">
                        <button class="btn-icon" onclick="SettingsModule.openDetectiveModal('${esc(key)}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" style="color:#ff3b30;" onclick="SettingsModule.deleteDetective('${esc(key)}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="faction-card-body">
                    <div class="faction-id">Discord: ${esc(d.discord_id)}</div>
                    <div class="faction-id">High Role: ${esc(d.high_role_id)}</div>
                    <div class="faction-id">Patch Log: ${esc(d.patch_log_channel)}</div>
                </div>
            </div>
        `
            )
            .join("");
    }

    function renderServers() {
        const s = settings.servers || {};
        setVal("server-chp", s.chp);
        setVal("server-mp", s.mp);
        setVal("server-test", s.test);
        setVal("server-check", (s.check || []).join(", "));
        setVal("server-admins", (s.admins || []).join(", "));
    }

    function renderPositions() {
        const grid = document.getElementById("positionsGrid");
        if (!grid) return;
        const pos = settings.state_positions || {};
        grid.innerHTML = Object.entries(pos)
            .map(
                ([key, p]) => `
            <div class="faction-card">
                <div class="faction-card-header">
                    <span class="faction-key">${esc(key)}</span>
                    <div class="faction-card-actions">
                        <button class="btn-icon" onclick="SettingsModule.openPositionModal('${esc(key)}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" style="color:#ff3b30;" onclick="SettingsModule.deletePosition('${esc(key)}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="faction-card-body">
                    <div class="faction-id">Ветки: ${esc((p.branches || []).join(", "))}</div>
                    <div class="faction-id">Должности: ${esc((p.positions || []).join(", "))}</div>
                </div>
            </div>
        `
            )
            .join("");
    }

    function renderRoles() {
        const grid = document.getElementById("systemRolesGrid");
        if (!grid) return;
        const roles = settings.system_roles || {};
        const labels = {
            gov_access_patch_request: "Доступ к запросам патчей (Gov)",
            detective_patch_access: "Доступ к патчам (Детективы)",
            gov_delete_patch: "Удаление патчей (Gov)",
            detectives_high: "High-роли детективов",
            capters: "Каптерские роли",
            gov_nickname_requests: "Запросы никнеймов",
        };
        grid.innerHTML = Object.entries(labels)
            .map(
                ([key, label]) => `
            <div class="form-group">
                <label>${esc(label)}</label>
                <input type="text" class="search-input" data-role-key="${esc(key)}" value="${esc(
                    (roles[key] || []).join(", ")
                )}" onchange="SettingsModule.updateRole(this)">
            </div>
        `
            )
            .join("");
    }

    function renderChannels() {
        const grid = document.getElementById("channelsGrid");
        if (!grid) return;
        const ch = settings.system_channels || {};
        const labels = {
            gov_patch_log: "Логи патчей (Gov)",
            transfer_log: "Трансфер-логи",
            punishment_admins: "Канал наказаний админов",
            gov_delete_patch: "Канал удаления патчей",
            chp_invite: "Канал приглашений",
            gov_nickname_requests: "Запросы никнеймов",
            admin_nickname_logs: "Логи никнеймов",
        };
        grid.innerHTML = Object.entries(labels)
            .map(
                ([key, label]) => `
            <div class="form-group">
                <label>${esc(label)}</label>
                <input type="text" class="search-input" data-channel-key="${esc(key)}" value="${esc(
                    ch[key] || ""
                )}" onchange="SettingsModule.updateChannel(this)">
            </div>
        `
            )
            .join("");
    }

    function updateRole(input) {
        const key = input.dataset.roleKey;
        const val = input.value.split(",").map((s) => s.trim()).filter(Boolean);
        if (!settings.system_roles) settings.system_roles = {};
        settings.system_roles[key] = val;
    }

    function updateChannel(input) {
        const key = input.dataset.channelKey;
        if (!settings.system_channels) settings.system_channels = {};
        settings.system_channels[key] = input.value.trim();
    }

    function saveServersToSettings() {
        if (!settings.servers) settings.servers = {};
        settings.servers.chp = getVal("server-chp");
        settings.servers.mp = getVal("server-mp");
        settings.servers.test = getVal("server-test");
        settings.servers.check = getVal("server-check").split(",").map((s) => s.trim()).filter(Boolean);
        settings.servers.admins = getVal("server-admins").split(",").map((s) => s.trim()).filter(Boolean);
    }

    function openFactionModal(key) {
        const faction = key
            ? settings.factions[key] || {}
            : {
                  label: "",
                  type: "criminal",
                  discord_id: "",
                  emoji_id: "",
                  roles: { faction: "", high: [], chp: "", mp: "" },
                  channels: { logs: "", patch_log: "", transfer_log: "" },
              };

        document.getElementById("factionModalTitle").innerHTML = key
            ? "Редактирование: " + key
            : "Новая фракция";
        document.getElementById("factionModalBody").innerHTML = `
            <input type="hidden" id="factionOldKey" value="${esc(key || "")}">
            ${key ? "" : '<div class="form-group"><label>Ключ (MM, LSPD...)</label><input type="text" id="factionKey" class="search-input" placeholder="Уникальный ключ"></div>'}
            <div class="form-group">
                <label>Название</label>
                <input type="text" id="factionLabel" class="search-input" value="${esc(faction.label)}">
            </div>
            <div class="form-group">
                <label>Тип</label>
                <div class="custom-select">
                    <input type="hidden" id="factionType" value="${esc(faction.type)}">
                    <div class="custom-select-trigger">
                        <span>${faction.type === "government" ? "Гос. структура" : "Криминальная"}</span>
                        <i class="fas fa-chevron-down arrow"></i>
                    </div>
                    <div class="custom-select-dropdown">
                        <div class="custom-select-option ${faction.type === "government" ? "selected" : ""}" data-value="government">Гос. структура</div>
                        <div class="custom-select-option ${faction.type === "criminal" ? "selected" : ""}" data-value="criminal">Криминальная</div>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Discord Server ID</label>
                <input type="text" id="factionDiscordId" class="search-input" value="${esc(faction.discord_id)}">
            </div>
            <div class="form-group">
                <label>Emoji ID</label>
                <input type="text" id="factionEmoji" class="search-input" value="${esc(faction.emoji_id)}">
            </div>
            <h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem;">Роли</h4>
            <div class="form-group">
                <label>Faction Role</label>
                <input type="text" id="factionRoleFaction" class="search-input" value="${esc(faction.roles.faction)}">
            </div>
            <div class="form-group">
                <label>High Roles (через запятую)</label>
                <input type="text" id="factionRoleHigh" class="search-input" value="${esc((faction.roles.high || []).join(", "))}">
            </div>
            <div class="form-group">
                <label>CHP Role</label>
                <input type="text" id="factionRoleChp" class="search-input" value="${esc(faction.roles.chp || "")}">
            </div>
            <div class="form-group">
                <label>MP Role</label>
                <input type="text" id="factionRoleMp" class="search-input" value="${esc(faction.roles.mp || "")}">
            </div>
            <h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem;">Каналы</h4>
            <div class="form-group">
                <label>Logs Channel</label>
                <input type="text" id="factionChannelLogs" class="search-input" value="${esc(faction.channels.logs || "")}">
            </div>
            <div class="form-group">
                <label>Patch Log Channel</label>
                <input type="text" id="factionChannelPatch" class="search-input" value="${esc(faction.channels.patch_log || "")}">
            </div>
            <div class="form-group">
                <label>Transfer Log Channel</label>
                <input type="text" id="factionChannelTransfer" class="search-input" value="${esc(faction.channels.transfer_log || "")}">
            </div>
        `;

        document.getElementById("factionModal").style.display = "flex";
        initCustomSelects();
    }

    function closeFactionModal() {
        document.getElementById("factionModal").style.display = "none";
    }

    function saveFaction() {
        const oldKey = getVal("factionOldKey");
        const key = oldKey || getVal("factionKey");

        if (!key) {
            showToast("Введите ключ", true);
            return;
        }

        const typeSelect = document.querySelector("#factionType");
        const typeValue = typeSelect?.value || getVal("factionType");

        const faction = {
            label: getVal("factionLabel"),
            type: typeValue,
            discord_id: getVal("factionDiscordId"),
            emoji_id: getVal("factionEmoji"),
            roles: {
                faction: getVal("factionRoleFaction"),
                high: getVal("factionRoleHigh")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                chp: getVal("factionRoleChp"),
                mp: getVal("factionRoleMp"),
            },
            channels: {
                logs: getVal("factionChannelLogs"),
                patch_log: getVal("factionChannelPatch"),
                transfer_log: getVal("factionChannelTransfer"),
            },
        };

        if (!settings.factions) settings.factions = {};
        if (oldKey && oldKey !== key) delete settings.factions[oldKey];
        settings.factions[key] = faction;

        closeFactionModal();
        renderFactions();
        showToast('Фракция сохранена в памяти. Нажмите "Сохранить всё"');
    }

    function deleteFaction(key) {
        if (!confirm("Удалить фракцию " + key + "?")) return;
        delete settings.factions[key];
        renderFactions();
        showToast('Фракция удалена из памяти. Нажмите "Сохранить всё"');
    }

    function openDetectiveModal(key) {
        const d = key
            ? settings.detectives[key] || {}
            : { discord_id: "", high_role_id: "", name_logs_id: "", patch_log_channel: "" };
        document.getElementById("detectiveModalTitle").innerHTML = key
            ? "Редактирование: " + key
            : "Новый отдел";
        document.getElementById("detectiveModalBody").innerHTML = `
            <input type="hidden" id="detectiveOldKey" value="${esc(key || "")}">
            ${key ? "" : '<div class="form-group"><label>Ключ</label><input type="text" id="detectiveKey" class="search-input"></div>'}
            <div class="form-group"><label>Discord Server ID</label><input type="text" id="detDiscordId" class="search-input" value="${esc(d.discord_id)}"></div>
            <div class="form-group"><label>High Role ID</label><input type="text" id="detHighRole" class="search-input" value="${esc(d.high_role_id)}"></div>
            <div class="form-group"><label>Name Logs ID</label><input type="text" id="detNameLogs" class="search-input" value="${esc(d.name_logs_id)}"></div>
            <div class="form-group"><label>Patch Log Channel</label><input type="text" id="detPatchLog" class="search-input" value="${esc(d.patch_log_channel)}"></div>
        `;
        document.getElementById("detectiveModal").style.display = "flex";
    }

    function closeDetectiveModal() {
        document.getElementById("detectiveModal").style.display = "none";
    }

    function saveDetective() {
        const oldKey = getVal("detectiveOldKey");
        const key = oldKey || getVal("detectiveKey");
        if (!key) {
            showToast("Введите ключ", true);
            return;
        }

        if (!settings.detectives) settings.detectives = {};
        if (oldKey && oldKey !== key) delete settings.detectives[oldKey];
        settings.detectives[key] = {
            discord_id: getVal("detDiscordId"),
            high_role_id: getVal("detHighRole"),
            name_logs_id: getVal("detNameLogs"),
            patch_log_channel: getVal("detPatchLog"),
        };

        closeDetectiveModal();
        renderDetectives();
        showToast("Отдел сохранен в памяти");
    }

    function deleteDetective(key) {
        if (!confirm("Удалить отдел " + key + "?")) return;
        delete settings.detectives[key];
        renderDetectives();
        showToast("Отдел удален из памяти");
    }

    function openPositionModal(key) {
        const p = key ? settings.state_positions[key] || {} : { branches: [], positions: [] };
        document.getElementById("positionModalTitle").innerHTML = key
            ? "Редактирование: " + key
            : "Новая структура";
        document.getElementById("positionModalBody").innerHTML = `
            <input type="hidden" id="positionOldKey" value="${esc(key || "")}">
            ${key ? "" : '<div class="form-group"><label>Название структуры</label><input type="text" id="positionKey" class="search-input"></div>'}
            <div class="form-group"><label>Ветки (через запятую)</label><input type="text" id="positionBranches" class="search-input" value="${esc((p.branches || []).join(", "))}"></div>
            <div class="form-group"><label>Должности (через запятую)</label><input type="text" id="positionPositions" class="search-input" value="${esc((p.positions || []).join(", "))}"></div>
        `;
        document.getElementById("positionModal").style.display = "flex";
    }

    function closePositionModal() {
        document.getElementById("positionModal").style.display = "none";
    }

    function savePosition() {
        const oldKey = getVal("positionOldKey");
        const key = oldKey || getVal("positionKey");
        if (!key) {
            showToast("Введите название", true);
            return;
        }

        if (!settings.state_positions) settings.state_positions = {};
        if (oldKey && oldKey !== key) delete settings.state_positions[oldKey];
        settings.state_positions[key] = {
            branches: getVal("positionBranches").split(",").map((s) => s.trim()).filter(Boolean),
            positions: getVal("positionPositions").split(",").map((s) => s.trim()).filter(Boolean),
        };

        closePositionModal();
        renderPositions();
        showToast("Структура сохранена в памяти");
    }

    function deletePosition(key) {
        if (!confirm("Удалить структуру " + key + "?")) return;
        delete settings.state_positions[key];
        renderPositions();
        showToast("Структура удалена из памяти");
    }

    async function loadHistory() {
        document.getElementById("historyModal").style.display = "flex";
        const list = document.getElementById("historyList");
        list.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Загрузка...</p>';
        try {
            const resp = await fetch("/admin/settings/api/settings/history");
            const data = await resp.json();
            list.innerHTML =
                (data.history || [])
                    .map(
                        (h) => `
                <div class="history-item">
                    <span>${new Date(h.date).toLocaleString("ru-RU")}</span>
                    <button class="btn-sm btn-secondary" onclick="SettingsModule.rollback('${h.filename}')">Откатить</button>
                </div>
            `
                    )
                    .join("") || '<p class="empty-text">Нет истории</p>';
        } catch (e) {
            list.innerHTML = '<p class="error-text">Ошибка загрузки</p>';
        }
    }

    function closeHistoryModal() {
        document.getElementById("historyModal").style.display = "none";
    }

    async function rollback(filename) {
        if (!confirm("Откатить к " + filename + "?")) return;
        try {
            const resp = await fetch("/admin/settings/api/settings/rollback/" + filename, { method: "POST" });
            const data = await resp.json();
            if (data.success) {
                showToast("Откачено. Перезагрузка...");
                setTimeout(() => location.reload(), 1000);
            } else {
                showToast(data.error || "Ошибка", true);
            }
        } catch (e) {
            showToast("Ошибка", true);
        }
    }

    function initCustomSelects() {
        document.querySelectorAll(".custom-select").forEach((select) => {
            const trigger = select.querySelector(".custom-select-trigger");
            const options = select.querySelectorAll(".custom-select-option");
            const hiddenInput = select.querySelector('input[type="hidden"]');

            if (!trigger) return;

            const newTrigger = trigger.cloneNode(true);
            trigger.parentNode.replaceChild(newTrigger, trigger);

            newTrigger.addEventListener("click", (e) => {
                e.stopPropagation();
                document.querySelectorAll(".custom-select.open").forEach((s) => {
                    if (s !== select) s.classList.remove("open");
                });
                select.classList.toggle("open");
            });

            options.forEach((opt) => {
                const newOpt = opt.cloneNode(true);
                opt.parentNode.replaceChild(newOpt, opt);

                newOpt.addEventListener("click", () => {
                    select.querySelectorAll(".custom-select-option").forEach((o) => o.classList.remove("selected"));
                    newOpt.classList.add("selected");
                    const span = select.querySelector(".custom-select-trigger span");
                    if (span) span.textContent = newOpt.textContent;
                    if (hiddenInput) hiddenInput.value = newOpt.dataset.value;
                    select.classList.remove("open");
                });
            });
        });
    }

    function getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value : "";
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || "";
    }

    function esc(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeFactionModal();
            closeDetectiveModal();
            closePositionModal();
            closeHistoryModal();
        }
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".custom-select")) {
            document.querySelectorAll(".custom-select.open").forEach((s) => s.classList.remove("open"));
        }
    });

    return {
        init,
        showTab,
        saveSettings,
        openFactionModal,
        closeFactionModal,
        saveFaction,
        deleteFaction,
        openDetectiveModal,
        closeDetectiveModal,
        saveDetective,
        deleteDetective,
        openPositionModal,
        closePositionModal,
        savePosition,
        deletePosition,
        updateRole,
        updateChannel,
        loadHistory,
        closeHistoryModal,
        rollback,
    };
})();

window.SettingsModule = SettingsModule;
document.addEventListener("DOMContentLoaded", () => SettingsModule.init());