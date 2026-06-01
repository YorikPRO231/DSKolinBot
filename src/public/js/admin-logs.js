const AdminLogsModule = (function () {
  let currentPage = 1;
  let totalEntries = 0;
  let totalPages = 1;
  let currentQuery = "";
  let currentCategory = "all";
  let currentDateFrom = "";
  let currentDateTo = "";
  let isLoading = false;
  let dateFromPicker, dateToPicker;

  function closeLogModal() {
    Utils.closeModal("logModal");
  }

  function openLogModal(content) {
    const modal = document.getElementById("logModal");
    const container = document.getElementById("logDetailContent");
    if (!modal || !container) return;
    container.innerHTML = content;
    Utils.showModal("logModal");
  }

  function initModal() {
    const modal = document.getElementById("logModal");
    if (!modal) return;

    modal.onclick = function (e) {
      if (e.target === modal) closeLogModal();
    };

    document
      .getElementById("closeModalBtn")
      ?.addEventListener("click", closeLogModal);
    document
      .getElementById("closeModalFooterBtn")
      ?.addEventListener("click", closeLogModal);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLogModal();
    });
  }

  function getEventClass(eventType) {
    if (!eventType) return "";
    const lowerEvent = eventType.toLowerCase();
    if (
      lowerEvent.includes("удален") ||
      lowerEvent.includes("бан") ||
      lowerEvent.includes("кик")
    )
      return "event-error";
    if (
      lowerEvent.includes("изменен") ||
      lowerEvent.includes("редактирован") ||
      lowerEvent.includes("переместился")
    )
      return "event-warning";
    if (
      lowerEvent.includes("создан") ||
      lowerEvent.includes("присоединился") ||
      lowerEvent.includes("добавлен")
    )
      return "event-success";
    return "";
  }

  function formatDisplayTime(timestamp) {
    if (!timestamp) return "—";
    try {
      const match = timestamp.match(
        /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
      );
      if (match) {
        const [, year, month, day, hours, minutes, seconds] = match;
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
      }
      return timestamp;
    } catch (e) {
      return timestamp;
    }
  }

  function truncateText(text, maxLength) {
    if (!text) return "";
    return text.length <= maxLength
      ? text
      : text.substring(0, maxLength) + "...";
  }

  async function fetchChannelName(channelId) {
    if (!channelId || !channelId.match(/^\d{17,20}$/)) return channelId;
    try {
      const response = await fetch(`/api/discord/channel/${channelId}/name`);
      const data = await response.json();
      if (data.success && data.name) return data.name;
    } catch (e) {
      console.debug("Failed to fetch channel name", e);
    }
    return channelId;
  }

  async function enrichEntryWithNames(entry) {
    const enriched = { ...entry };
    if (
      enriched.channelId &&
      (!enriched.channelName || enriched.channelName === enriched.channelId)
    ) {
      enriched.channelName = await fetchChannelName(enriched.channelId);
    }
    return enriched;
  }

  function generateModalContentSync(entry) {
    const eventClass = getEventClass(entry.event);
    let contentHtml = `
      <div class="detail-event-badge ${eventClass}">
        ${Utils.escapeHtml(entry.event || "Событие")}
      </div>
      <div class="detail-grid">
        <div class="detail-card">
          <div class="detail-card-label">Время события</div>
          <div class="detail-card-value">${formatDisplayTime(entry.timestamp)}</div>
        </div>
        <div class="detail-card">
          <div class="detail-card-label">ID пользователя</div>
          <div class="detail-card-value monospace">${entry.userId ? `<code>${Utils.escapeHtml(entry.userId)}</code>` : "—"}</div>
        </div>
        <div class="detail-card">
          <div class="detail-card-label">Пользователь</div>
          <div class="detail-card-value">${Utils.escapeHtml(entry.userName || "—")}</div>
        </div>
    `;

    if (entry.channelId || entry.channelName) {
      contentHtml += `
        <div class="detail-card">
          <div class="detail-card-label">Канал</div>
          <div class="detail-card-value">${entry.channelName ? `#${Utils.escapeHtml(entry.channelName)}` : Utils.escapeHtml(entry.channelId || "—")}</div>
        </div>
      `;
    }

    if (entry.guildId || entry.guildName) {
      contentHtml += `
        <div class="detail-card">
          <div class="detail-card-label">Сервер</div>
          <div class="detail-card-value">${Utils.escapeHtml(entry.guildName || entry.guildId || "—")}</div>
        </div>
      `;
    }

    if (entry.messageLink) {
      contentHtml += `
        <div class="detail-card">
          <div class="detail-card-label">Ссылка</div>
          <div class="detail-card-value">
            <a href="${Utils.escapeHtml(entry.messageLink)}" target="_blank" rel="noopener noreferrer" style="color: var(--log-accent); text-decoration: none;">
              🔗 Перейти к сообщению
            </a>
          </div>
        </div>
      `;
    }

    contentHtml += `</div>`;

    if (entry.content) {
      contentHtml += `
        <div class="raw-log-section">
          <div class="raw-log-title">Содержание сообщения</div>
          <div class="code-view">${Utils.escapeHtml(entry.content)}</div>
        </div>
      `;
    }

    if (entry.oldContent || entry.newContent) {
      contentHtml += `
        <div class="raw-log-section">
          <div class="raw-log-title">Изменения в сообщении</div>
          <div class="content-diff">
            <div class="diff-old">
              <div class="diff-label">Было:</div>
              <div class="code-view" style="background: rgba(231, 76, 60, 0.1);">${Utils.escapeHtml(entry.oldContent || "(пусто)")}</div>
            </div>
            <div class="diff-new">
              <div class="diff-label">Стало:</div>
              <div class="code-view" style="background: rgba(46, 204, 113, 0.1);">${Utils.escapeHtml(entry.newContent || "(пусто)")}</div>
            </div>
          </div>
        </div>
      `;
    }

    contentHtml += `
      <div class="raw-log-section">
        <div class="raw-log-title">Полный лог записи</div>
        <div class="code-view">${Utils.escapeHtml(entry.raw || "Нет данных")}</div>
      </div>
      <div class="raw-log-section">
        <div class="raw-log-title">Источник</div>
        <div class="code-view" style="font-size: 11px; background: rgba(0,0,0,0.2);">${Utils.escapeHtml(entry.file || "—")}</div>
      </div>
    `;

    return contentHtml;
  }

  async function openLogModalWithEntry(entry) {
    openLogModal(
      '<div style="text-align: center; padding: 40px;">Загрузка деталей...</div>',
    );
    try {
      const enrichedEntry = await enrichEntryWithNames(entry);
      const content = generateModalContentSync(enrichedEntry);
      const container = document.getElementById("logDetailContent");
      if (container) container.innerHTML = content;
    } catch (error) {
      console.error(error);
      const container = document.getElementById("logDetailContent");
      if (container) {
        container.innerHTML =
          '<div style="text-align: center; padding: 40px; color: var(--log-error);">Ошибка загрузки деталей</div>';
      }
    }
  }

  function renderSkeletons() {
    const body = document.getElementById("logsTableBody");
    if (!body) return;

    let skeletonHtml = "";
    for (let i = 0; i < 8; i++) {
      skeletonHtml += `
        <tr class="skeleton-row">
          <td><div class="skeleton-cell animate-pulse" style="width: 120px; height: 16px;"></div></td>
          <td><div class="skeleton-cell animate-pulse" style="width: 100px; height: 24px; border-radius: 6px;"></div></td>
          <td><div class="skeleton-cell animate-pulse" style="width: 140px; height: 16px;"></div></td>
          <td><div class="skeleton-cell animate-pulse" style="width: 85%; height: 16px;"></div></td>
        </tr>
      `;
    }
    body.innerHTML = skeletonHtml;
  }

  function initTableEvents() {
    const tableBody = document.getElementById("logsTableBody");
    if (!tableBody) return;

    tableBody.addEventListener("click", async function (e) {
      const row = e.target.closest(".row-clickable");
      if (!row) return;

      const index = parseInt(row.getAttribute("data-log-index"), 10);
      if (window.logEntriesData && window.logEntriesData[index]) {
        await openLogModalWithEntry(window.logEntriesData[index]);
      }
    });
  }

  function initCustomSelect() {
    const container = document.getElementById("categorySelectContainer");
    if (!container) return;

    const trigger = container.querySelector(".custom-select-trigger");
    const options = container.querySelectorAll(".custom-option");
    const realSelect = document.getElementById("categoryFilter");
    const textSpan = container.querySelector(".custom-select-text");

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      container.classList.toggle("active");
    });

    options.forEach((option) => {
      option.addEventListener("click", function (e) {
        e.stopPropagation();
        options.forEach((opt) => opt.classList.remove("selected"));
        this.classList.add("selected");

        const val = this.getAttribute("data-value");
        textSpan.textContent = this.textContent;
        realSelect.value = val;

        container.classList.remove("active");
        performSearch(1);
      });
    });

    document.addEventListener("click", function () {
      container.classList.remove("active");
    });
  }

  async function performSearch(page = 1) {
    if (isLoading) return;
    isLoading = true;

    currentPage = page;
    currentQuery = document.getElementById("searchInput")?.value || "";
    currentCategory = document.getElementById("categoryFilter")?.value || "all";
    currentDateFrom = document.getElementById("dateFrom")?.value || "";
    currentDateTo = document.getElementById("dateTo")?.value || "";

    renderSkeletons();

    const body = document.getElementById("logsTableBody");
    const startTime = performance.now();

    try {
      const params = new URLSearchParams({
        q: currentQuery,
        category: currentCategory,
        limit: "50",
        offset: ((page - 1) * 50).toString(),
      });

      if (currentDateFrom) params.append("dateFrom", currentDateFrom);
      if (currentDateTo) params.append("dateTo", currentDateTo);

      const response = await fetch(`/admin-logs/search?${params.toString()}`);
      const data = await response.json();
      const endTime = performance.now();
      const queryTime = Math.round(endTime - startTime);

      if (!data.entries || data.entries.length === 0) {
        body.innerHTML =
          '<tr><td colspan="4" style="text-align: center; padding: 50px; color: var(--log-text-dim);">Ничего не найдено</td></tr>';
        document.getElementById("pagination").style.display = "none";
        document.getElementById("searchStats").style.display = "none";
        isLoading = false;
        return;
      }

      totalEntries = data.total;
      totalPages = Math.ceil(totalEntries / 50);
      window.logEntriesData = data.entries;

      body.innerHTML = data.entries
        .map((entry, index) => {
          const eventClass = getEventClass(entry.event);
          const displayTime = formatDisplayTime(entry.timestamp);
          const displayId = entry.userId || "Система";
          const displayDesc = truncateText(
            entry.description || entry.event || "Нет описания",
            120,
          );

          return `
            <tr class="row-clickable" data-log-index="${index}" tabindex="0">
              <td style="color: var(--log-text-dim); white-space: nowrap;">${displayTime}</td>
              <td><span class="tag-event ${eventClass}">${Utils.escapeHtml(entry.event || "Лог")}</span></td>
              <td class="id-cell"><code style="font-size: 12px;">${Utils.escapeHtml(displayId)}</code></td>
              <td style="max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${Utils.escapeHtml(displayDesc)}">${Utils.escapeHtml(displayDesc)}</td>
            </tr>
          `;
        })
        .join("");

      const statsDiv = document.getElementById("searchStats");
      if (statsDiv) {
        statsDiv.style.display = "flex";
        document.getElementById("totalCount").innerText = totalEntries;
        document.getElementById("queryTime").innerText = queryTime;
      }

      const paginationDiv = document.getElementById("pagination");

      if (paginationDiv) {
        if (totalPages > 1) {
          paginationDiv.style.display = "flex";
          document.getElementById("pageInfo").innerHTML =
            `Страница ${currentPage} из ${totalPages} <span style="color: var(--log-text-dim);">(всего ${totalEntries} записей)</span>`;
          document.getElementById("prevPageBtn").disabled = currentPage === 1;
          document.getElementById("nextPageBtn").disabled =
            currentPage >= totalPages;
        } else {
          paginationDiv.style.display = "none";
        }
      }
    } catch (e) {
      console.error(e);
      body.innerHTML =
        '<tr><td colspan="4" style="text-align: center; padding: 50px; color: #ff5f5f;">Ошибка при выполнении поиска</td></tr>';
      document.getElementById("searchStats").style.display = "none";
      document.getElementById("pagination").style.display = "none";
    } finally {
      isLoading = false;
    }
  }

  function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) performSearch(newPage);
  }

  function resetFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("categoryFilter").value = "all";

    const container = document.getElementById("categorySelectContainer");
    if (container) {
      container.querySelector(".custom-select-text").textContent =
        "Все категории";
      container.querySelectorAll(".custom-option").forEach((opt, idx) => {
        opt.classList.toggle("selected", idx === 0);
      });
    }

    if (dateFromPicker) dateFromPicker.clear();
    if (dateToPicker) dateToPicker.clear();
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    performSearch(1);
  }

  function initDatePickers() {
    if (typeof flatpickr !== "undefined") {
      const config = {
        locale: "ru",
        dateFormat: "Y-m-d",
        theme: "dark",
        disableMobile: "true",
        onChange: function () {
          performSearch(1);
        },
      };
      dateFromPicker = flatpickr("#dateFrom", config);
      dateToPicker = flatpickr("#dateTo", config);
    }
  }

  return {
    performSearch,
    changePage,
    resetFilters,
    initModal,
    initDatePickers,
    initTableEvents,
    initCustomSelect,
    closeLogModal,
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  AdminLogsModule.initModal();
  AdminLogsModule.initDatePickers();
  AdminLogsModule.initTableEvents();
  AdminLogsModule.initCustomSelect();

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") AdminLogsModule.performSearch(1);
    });
  }

  AdminLogsModule.performSearch(1);

  window.performSearch = AdminLogsModule.performSearch;
  window.changePage = AdminLogsModule.changePage;
  window.resetFilters = AdminLogsModule.resetFilters;
});
