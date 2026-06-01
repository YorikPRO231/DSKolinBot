const InspectionsModule = (function () {
  let currentPage = 0;
  let totalPages = 0;
  let currentSearchQuery = "";
  let currentSearchType = "passport";
  const limit = 10;

  async function loadPage(page) {
    const tbody = document.getElementById("reportsList");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="table-loading-state-cell"><div class="spinner-element-loader"></div><span>Получение актуальных данных...</span></td></tr>`;

    try {
      const response = await fetch(
        `/api/inspections/search?query=${encodeURIComponent(currentSearchQuery)}&type=${currentSearchType}&page=${page}&limit=${limit}`
      );
      const data = await response.json();

      if (data.success) {
        currentPage = data.currentPage;
        totalPages = data.totalPages;

        const pageInfo = document.getElementById("pageInfo");
        const prevBtn = document.getElementById("prevBtn");
        const nextBtn = document.getElementById("nextBtn");

        if (pageInfo)
          pageInfo.innerText = `Страница ${currentPage + 1} из ${totalPages || 1}`;
        if (prevBtn) prevBtn.disabled = currentPage === 0;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;

        if (data.records.length === 0) {
          tbody.innerHTML = `<tr><td colspan="6" class="table-status-message-cell"><i class="fas fa-folder-open status-icon-dim"></i><p>По вашему запросу записей не найдено</p></td></tr>`;
          return;
        }

        let html = "";
        data.records.forEach((rec) => {
          html +=
            `<tr>` +
            `<td><div class="passport-container-badge"><i class="far fa-id-badge"></i> <span>${Utils.escapeHtml(rec.passport)}</span></div></td>` +
            `<td><span class="discord-code-style">${Utils.escapeHtml(rec.discord_id || "-")}</span></td>` +
            `<td><div class="cell-reason-scrollable">${Utils.escapeHtml(rec.result)}</div></td>` +
            `<td><div class="admin-cell-flex"><i class="far fa-user"></i> <span>${Utils.escapeHtml(rec.admin_name || rec.admin_id)}</span></div></td>` +
            `<td><span class="datetime-display">${Utils.formatDate(rec.created_at)}</span></td>` +
            `<td class="text-center" onclick="event.stopPropagation();">` +
            `<div class="action-menu">` +
            `<button class="dots-btn" onclick="InspectionsModule.toggleDropdown(event, ${rec.id})">···</button>` +
            `<div id="dropdown-${rec.id}" class="dropdown-content">` +
            `<button onclick="InspectionsModule.openEditModal(${rec.id}, '${Utils.escapeHtml(rec.passport)}', '${Utils.escapeHtml(rec.discord_id)}', \`${Utils.escapeHtml(rec.result)}\`)">` +
            `<i class="fas fa-pen"></i> Изменить` +
            `</button>` +
            `</div>` +
            `</div>` +
            `</td>` +
            `</tr>`;
        });
        tbody.innerHTML = html;
      } else {
        tbody.innerHTML = `<tr><td colspan="6" class="table-status-message-cell"><p>Ошибка получения данных с сервера</p></td></tr>`;
      }
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="6" class="table-status-message-cell"><p>Сбой сетевого подключения</p></td></tr>`;
    }
  }

  function searchRecords() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (!query) {
      Utils.showToast("Введите критерий для поиска", true);
      return;
    }
    currentSearchQuery = query;
    currentSearchType =
      /^\d+$/.test(query) && query.length < 15 ? "passport" : "discord";

    const resultsSection = document.getElementById("resultsSection");
    const resultsTitle = document.getElementById("resultsTitle");

    if (resultsSection) resultsSection.style.display = "block";
    if (resultsTitle) resultsTitle.innerText = `Результаты поиска: ${query}`;
    loadPage(0);
  }

  function toggleDropdown(event, id) {
    event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${id}`);
    if (!dropdown) return;

    const isVisible = dropdown.style.display === "block";

    document
      .querySelectorAll(".dropdown-content")
      .forEach((el) => (el.style.display = "none"));

    if (!isVisible) {
      dropdown.style.display = "block";
      const rect = event.target.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
      dropdown.style.left = `${rect.right - 150 + window.scrollX}px`;
    }
  }

  function openEditModal(id, passport, discordId, result) {
    document.getElementById("editId").value = id;
    document.getElementById("editPassport").value = passport;
    document.getElementById("editDiscordId").value =
      discordId === "-" ? "" : discordId;
    document.getElementById("editResult").value = result;

    const modal = document.getElementById("editModal");
    if (modal) {
      modal.classList.add("show");
      document.body.style.overflow = "hidden";
    }
    document
      .querySelectorAll(".dropdown-content")
      .forEach((el) => (el.style.display = "none"));
  }

  function closeModal(modalId) {
    Utils.closeModal(modalId);
  }

  async function saveEdit(event) {
    if (event) event.preventDefault();
    const id = document.getElementById("editId").value;
    const discordId = document.getElementById("editDiscordId").value.trim();
    const result = document.getElementById("editResult").value.trim();

    if (!result) {
      Utils.showToast('Поле "Результат" обязательно для заполнения', true);
      return;
    }

    try {
      const response = await fetch(`/api/inspections/update/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_id: discordId, result: result }),
      });

      const data = await response.json();

      if (data.success) {
        Utils.showToast("Запись сохранена");
        closeModal("editModal");
        loadPage(currentPage);
      } else {
        const errorMsg = data.error || data.message || "Не удалось обновить запись";
        Utils.showToast(errorMsg, true);
      }
    } catch (e) {
      console.error(e);
      Utils.showToast("Ошибка соединения с сервером", true);
    }
  }

  function previousPage() {
    if (currentPage > 0) loadPage(currentPage - 1);
  }

  function nextPage() {
    if (currentPage < totalPages - 1) loadPage(currentPage + 1);
  }

  function initGlobalListeners() {
    document.addEventListener("click", function (event) {
      if (!event.target.closest(".action-menu")) {
        document
          .querySelectorAll(".dropdown-content")
          .forEach((el) => (el.style.display = "none"));
      }
      if (event.target.classList.contains("modal-blur-overlay")) {
        closeModal(event.target.id);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        const activeModal = document.querySelector(".modal-blur-overlay.show");
        if (activeModal) closeModal(activeModal.id);
        document
          .querySelectorAll(".dropdown-content")
          .forEach((el) => (el.style.display = "none"));
      }
    });
  }

  return {
    searchRecords,
    toggleDropdown,
    openEditModal,
    closeEditModal: () => closeModal("editModal"),
    saveEdit,
    previousPage,
    nextPage,
    initGlobalListeners,
  };
})();

window.InspectionsModule = InspectionsModule;
window.searchRecords = InspectionsModule.searchRecords;
window.previousPage = InspectionsModule.previousPage;
window.nextPage = InspectionsModule.nextPage;
window.toggleDropdown = InspectionsModule.toggleDropdown;
window.openEditModal = InspectionsModule.openEditModal;
window.closeEditModal = InspectionsModule.closeEditModal;

document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        InspectionsModule.searchRecords();
      }
    });
  }
  InspectionsModule.initGlobalListeners();
});