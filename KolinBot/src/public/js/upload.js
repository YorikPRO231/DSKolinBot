const UploadModule = (function() {
    let currentResults = null;
    let currentSort = { column: null, direction: 'asc' };
    let currentPage = 1;
    let itemsPerPage = 25;
    let currentFilter = '';

    function showToast(message, isError) {
        if (isError === undefined) isError = false;
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-notification' + (isError ? ' error' : '');
        toast.innerHTML = '<i class="fas ' + (isError ? 'fa-exclamation-circle' : 'fa-check-circle') + '"></i><span>' + message + '</span>';
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 3000);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncateContext(context, maxLength) {
        if (!context) return '';
        maxLength = maxLength || 150;
        if (context.length <= maxLength) return escapeHtml(context);
        return escapeHtml(context.substring(0, maxLength)) + '...';
    }

    function renderPagination(total, page, totalPages) {
        return `
            <div class="pagination">
                <button class="first-page" ${page === 1 ? 'disabled' : ''}><i class="fas fa-angle-double-left"></i></button>
                <button class="prev-page" ${page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
                <span class="page-info">Страница ${page} из ${totalPages || 1} (всего: ${total})</span>
                <button class="next-page" ${page === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
                <button class="last-page" ${page === totalPages ? 'disabled' : ''}><i class="fas fa-angle-double-right"></i></button>
                <select class="per-page-select">
                    <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
                    <option value="200" ${itemsPerPage === 200 ? 'selected' : ''}>200</option>
                </select>
                <span>записей на странице</span>
            </div>
        `;
    }

    function attachPaginationEvents(getDataFn, renderFn) {
        const firstBtn = document.querySelector('.first-page');
        const prevBtn = document.querySelector('.prev-page');
        const nextBtn = document.querySelector('.next-page');
        const lastBtn = document.querySelector('.last-page');
        const perPageSelect = document.querySelector('.per-page-select');

        if (firstBtn) {
            firstBtn.onclick = function() { 
                currentPage = 1; 
                renderFn(); 
            };
        }
        if (prevBtn) {
            prevBtn.onclick = function() { 
                if (currentPage > 1) { 
                    currentPage--; 
                    renderFn(); 
                } 
            };
        }
        if (nextBtn) {
            nextBtn.onclick = function() { 
                const totalPages = Math.ceil(getDataFn().length / itemsPerPage); 
                if (currentPage < totalPages) { 
                    currentPage++; 
                    renderFn(); 
                } 
            };
        }
        if (lastBtn) {
            lastBtn.onclick = function() { 
                const totalPages = Math.ceil(getDataFn().length / itemsPerPage); 
                currentPage = totalPages; 
                renderFn(); 
            };
        }
        if (perPageSelect) {
            perPageSelect.onchange = function(e) { 
                itemsPerPage = parseInt(e.target.value); 
                currentPage = 1; 
                renderFn(); 
            };
        }
    }

    function getFilteredEmails() {
        if (!currentResults || !currentResults.emails) return [];

        let filtered = currentResults.emails.filter(function(item) {
            return !currentFilter || 
                item.email.toLowerCase().includes(currentFilter.toLowerCase()) ||
                item.provider.toLowerCase().includes(currentFilter.toLowerCase()) ||
                item.context.toLowerCase().includes(currentFilter.toLowerCase());
        });

        if (currentSort.column) {
            filtered.sort(function(a, b) {
                let aVal = a[currentSort.column];
                let bVal = b[currentSort.column];
                
                if (currentSort.column === 'line') {
                    aVal = parseInt(aVal) || 0;
                    bVal = parseInt(bVal) || 0;
                }
                
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }
                
                if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }

    function getFilteredSites() {
        if (!currentResults || !currentResults.cheatSites) return [];

        return currentResults.cheatSites.filter(function(item) {
            return !currentFilter || 
                item.site.toLowerCase().includes(currentFilter.toLowerCase()) ||
                item.domain.toLowerCase().includes(currentFilter.toLowerCase()) ||
                item.context.toLowerCase().includes(currentFilter.toLowerCase());
        });
    }

    function renderEmails() {
        if (!currentResults) return;

        const container = document.getElementById('emailResults');
        if (!container) return;

        const filteredData = getFilteredEmails();
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        const start = (currentPage - 1) * itemsPerPage;
        const paginatedData = filteredData.slice(start, start + itemsPerPage);

        if (filteredData.length === 0) {
            container.innerHTML = '<div class="empty-results"><i class="fas fa-inbox"></i><p>Email адреса не найдены</p></div>';
            return;
        }

        let html = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="email"><i class="fas fa-sort"></i> Email</th>
                            <th class="sortable" data-sort="provider"><i class="fas fa-sort"></i> Провайдер</th>
                            <th class="sortable" data-sort="line"><i class="fas fa-sort"></i> Строка</th>
                            <th>Контекст</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        paginatedData.forEach(function(item, index) {
            const rowId = 'email-row-' + index;
            html += `
                <tr class="clickable-row" data-row-id="${rowId}">
                    <td><code>${escapeHtml(item.email)}</code></td>
                    <td><span class="provider-badge">${escapeHtml(item.provider)}</span></td>
                    <td class="text-center"><span class="line-badge">${item.line}</span></td>
                    <td class="context-cell">${truncateContext(item.context, 150)}</td>
                </tr>
                <tr class="row-detail" id="${rowId}-detail">
                    <td colspan="4">
                        <div class="full-context">
                            <strong>Строка ${item.line}:</strong>
                            <pre>${escapeHtml(item.context)}</pre>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
            ${renderPagination(filteredData.length, currentPage, totalPages)}
        `;

        container.innerHTML = html;

        container.querySelectorAll('.sortable').forEach(function(th) {
            th.addEventListener('click', function() {
                const column = this.getAttribute('data-sort');
                if (currentSort.column === column) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.column = column;
                    currentSort.direction = 'asc';
                }
                currentPage = 1;
                renderEmails();
            });
        });

        container.querySelectorAll('.clickable-row').forEach(function(row) {
            row.addEventListener('click', function() {
                const rowId = this.getAttribute('data-row-id');
                const detailRow = document.getElementById(rowId + '-detail');
                if (detailRow) {
                    detailRow.classList.toggle('show');
                }
            });
        });

        attachPaginationEvents(getFilteredEmails, renderEmails);
    }

    function renderCheatSites() {
        if (!currentResults) return;

        const container = document.getElementById('cheatSitesResults');
        if (!container) return;

        const filteredData = getFilteredSites();

        if (filteredData.length === 0) {
            container.innerHTML = '<div class="empty-results"><i class="fas fa-shield-alt"></i><p>Сайты читов не найдены</p></div>';
            return;
        }

        let html = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Сайт</th>
                            <th>Домен</th>
                            <th>Строка</th>
                            <th>Контекст</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filteredData.forEach(function(item, index) {
            const rowId = 'site-row-' + index;
            html += `
                <tr class="clickable-row" data-row-id="${rowId}">
                    <td><span class="cheat-badge">${escapeHtml(item.site)}</span></td>
                    <td><code>${escapeHtml(item.domain)}</code></td>
                    <td class="text-center"><span class="line-badge">${item.line}</span></td>
                    <td class="context-cell">${truncateContext(item.context, 150)}</td>
                </tr>
                <tr class="row-detail" id="${rowId}-detail">
                    <td colspan="4">
                        <div class="full-context">
                            <strong>Строка ${item.line}:</strong>
                            <pre>${escapeHtml(item.context)}</pre>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        container.querySelectorAll('.clickable-row').forEach(function(row) {
            row.addEventListener('click', function() {
                const rowId = this.getAttribute('data-row-id');
                const detailRow = document.getElementById(rowId + '-detail');
                if (detailRow) {
                    detailRow.classList.toggle('show');
                }
            });
        });
    }

    function renderAllResults() {
        renderEmails();
        renderCheatSites();
    }

    function exportToCSV(type) {
        if (!currentResults) return;
        
        let data = [];
        let filename = '';
        const BOM = '\uFEFF';

        if (type === 'emails') {
            data = currentResults.emails.map(function(item) { 
                return { Email: item.email, Провайдер: item.provider, Строка: item.line, Контекст: item.context }; 
            });
            filename = 'emails_export.csv';
        } else if (type === 'sites') {
            data = currentResults.cheatSites.map(function(item) { 
                return { Сайт: item.site, Домен: item.domain, Строка: item.line, Контекст: item.context }; 
            });
            filename = 'cheat_sites_export.csv';
        } else if (type === 'all') {
            currentResults.emails.forEach(function(item) {
                data.push({ Тип: 'Email', Значение: item.email, Дополнительно: item.provider, Строка: item.line, Контекст: item.context });
            });
            currentResults.cheatSites.forEach(function(item) {
                data.push({ Тип: 'Сайт чита', Значение: item.site, Дополнительно: item.domain, Строка: item.line, Контекст: item.context });
            });
            filename = 'all_results_export.csv';
        }

        if (data.length === 0) {
            showToast('Нет данных для экспорта', true);
            return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        
        data.forEach(function(row) {
            const values = headers.map(function(header) {
                const value = row[header] || '';
                return '"' + value.toString().replace(/"/g, '""') + '"';
            });
            csvRows.push(values.join(','));
        });

        const blob = new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Экспортировано ' + data.length + ' записей');
    }

    function copyEmailsToClipboard() {
        if (!currentResults || !currentResults.emails || currentResults.emails.length === 0) {
            showToast('Нет email адресов для копирования', true);
            return;
        }
        
        const emails = currentResults.emails.map(function(item) {
            return item.email;
        }).join('\n');
        
        navigator.clipboard.writeText(emails).then(function() {
            showToast('Скопировано ' + currentResults.emails.length + ' email адресов');
        }).catch(function() {
            showToast('Ошибка копирования', true);
        });
    }

    function loadResultsFromPage() {
        const dataElement = document.getElementById('resultsData');
        if (!dataElement) return false;

        try {
            const emailsJson = decodeURIComponent(dataElement.getAttribute('data-emails') || '[]');
            const sitesJson = decodeURIComponent(dataElement.getAttribute('data-cheatsites') || '[]');
            
            currentResults = {
                emails: JSON.parse(emailsJson),
                cheatSites: JSON.parse(sitesJson),
                totalLines: parseInt(dataElement.getAttribute('data-totallines') || '0'),
                processedLines: parseInt(dataElement.getAttribute('data-processedlines') || '0')
            };
            
            return true;
        } catch (e) {
            console.error('Error loading results:', e);
            return false;
        }
    }

    function init() {
        const fileInput = document.getElementById('logFile');
        const fileLabel = document.getElementById('fileInputLabel');
        const dropZone = document.getElementById('dropZone');
        const uploadForm = document.getElementById('uploadForm');
        const submitBtn = document.getElementById('submitBtn');
        
        if (loadResultsFromPage()) {
            renderAllResults();
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                currentFilter = e.target.value.trim().toLowerCase();
                currentPage = 1;
                renderAllResults();
            });
        }

        const copyEmailsBtn = document.getElementById('copyEmails');
        const exportEmailsBtn = document.getElementById('exportEmails');
        const exportSitesBtn = document.getElementById('exportSites');
        const exportAllBtn = document.getElementById('exportAll');

        if (copyEmailsBtn) copyEmailsBtn.addEventListener('click', copyEmailsToClipboard);
        if (exportEmailsBtn) exportEmailsBtn.addEventListener('click', function() { exportToCSV('emails'); });
        if (exportSitesBtn) exportSitesBtn.addEventListener('click', function() { exportToCSV('sites'); });
        if (exportAllBtn) exportAllBtn.addEventListener('click', function() { exportToCSV('all'); });

        if (fileLabel) {
            fileLabel.addEventListener('click', function(e) {
                e.preventDefault();
                fileInput.click();
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                if (e.target.files && e.target.files[0]) {
                    const fileNameSpan = document.getElementById('fileName');
                    if (fileNameSpan) {
                        fileNameSpan.textContent = e.target.files[0].name;
                        fileNameSpan.style.color = 'var(--text-main)';
                    }
                }
            });
        }

        if (dropZone) {
            ['dragenter', 'dragover'].forEach(function(eventName) {
                dropZone.addEventListener(eventName, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add('drag-over');
                });
            });

            ['dragleave', 'drop'].forEach(function(eventName) {
                dropZone.addEventListener(eventName, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove('drag-over');
                });
            });

            dropZone.addEventListener('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    if (file.name.endsWith('.txt')) {
                        fileInput.files = files;
                        const fileNameSpan = document.getElementById('fileName');
                        if (fileNameSpan) {
                            fileNameSpan.textContent = file.name;
                            fileNameSpan.style.color = 'var(--text-main)';
                        }
                        showToast('Файл "' + file.name + '" загружен');
                    } else {
                        showToast('Допускаются только файлы с расширением .txt', true);
                    }
                }
            });
        }

        if (uploadForm && submitBtn) {
            uploadForm.addEventListener('submit', function(e) {
                if (!fileInput.files || !fileInput.files[0]) {
                    e.preventDefault();
                    showToast('Выберите файл для анализа', true);
                    return;
                }
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Анализирую файл...';
            });
        }
    }
    
    return { init: init };
})();

document.addEventListener('DOMContentLoaded', function() {
    UploadModule.init();
});