const InspectionsModule = (function() {
    let currentPage = 0;
    let totalPages = 0;
    let currentSearchQuery = '';
    let currentSearchType = 'passport';
    const limit = 10;

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function showToast(message, isError = false) {
        const toastSuccess = document.getElementById('toast');
        const toastError = document.getElementById('toastError');
        
        if (isError) {
            const toastMessage = document.getElementById('toastErrorMsg');
            toastMessage.innerText = message;
            if (toastSuccess) toastSuccess.style.display = 'none';
            if (toastError) {
                toastError.style.display = 'flex';
                setTimeout(() => {
                    toastError.style.display = 'none';
                }, 3000);
            }
        } else {
            const toastMessage = document.getElementById('toastMessage');
            toastMessage.innerText = message;
            if (toastError) toastError.style.display = 'none';
            if (toastSuccess) {
                toastSuccess.style.display = 'flex';
                setTimeout(() => {
                    toastSuccess.style.display = 'none';
                }, 3000);
            }
        }
    }

    function toggleDropdown(event, id) {
        event.stopPropagation();
        const dropdown = document.getElementById('dropdown-' + id);
        const button = event.target;
        const rect = button.getBoundingClientRect();
        
        document.querySelectorAll('.dropdown-content').forEach(el => {
            if (el.id !== 'dropdown-' + id) {
                el.style.display = 'none';
            }
        });
        
        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
        } else {
            dropdown.style.position = 'fixed';
            dropdown.style.top = (rect.bottom + 5) + 'px';
            dropdown.style.left = (rect.left - 100) + 'px';
            dropdown.style.display = 'block';
        }
    }

    function searchRecords() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            showToast('Введите паспорт или Discord ID', true);
            return;
        }
        
        if (/^\d+$/.test(query)) {
            if (query.length > 15) {
                currentSearchType = 'discord';
            } else {
                currentSearchType = 'passport';
            }
        } else {
            currentSearchType = 'discord';
        }
        
        currentSearchQuery = query;
        currentPage = 0;
        document.getElementById('resultsSection').style.display = 'block';
        loadReports();
    }

    async function loadReports() {
        try {
            let url;
            if (currentSearchType === 'passport') {
                url = '/api/inspections/passport/' + encodeURIComponent(currentSearchQuery) + '?limit=' + limit + '&offset=' + (currentPage * limit);
            } else {
                url = '/api/inspections/discord/' + encodeURIComponent(currentSearchQuery) + '?limit=' + limit + '&offset=' + (currentPage * limit);
            }
            
            const res = await fetch(url);
            const data = await res.json();
            const list = document.getElementById('reportsList');
            
            if (data.success) {
                totalPages = Math.ceil(data.total / limit);
                document.getElementById('resultsTitle').innerText = 'Найдено записей: ' + data.total;
                
                if (data.reports && data.reports.length) {
                    list.innerHTML = data.reports.map(function(r) {
                        let escapedResult = escapeHtml(r.result);
                        let displayResult = escapedResult;
                        if (escapedResult.length > 150) {
                            displayResult = escapedResult.substring(0, 150) + '...';
                        }
                        
                        let jsSafeResult = r.result
                            .replace(/\\/g, '\\\\')   
                            .replace(/'/g, "\\'")  
                            .replace(/"/g, '\\"')     
                            .replace(/\n/g, '\\n')   
                            .replace(/\r/g, '\\r');   
                        
                        return '<tr>' +
                            '<td><strong style="color:#fff;">' + escapeHtml(r.passport) + '</strong></td>' +
                            '<td><code style="background:rgba(255,255,255,0.05); padding:3px 8px; border-radius:5px; font-size:0.8rem;">' + (r.discord_id || '—') + '</code></td>' +
                            '<td title="' + escapedResult.replace(/"/g, '&quot;') + '">' + displayResult + '</td>' +
                            '<td>' + escapeHtml(r.admin_name) + '</td>' +
                            '<td style="color:var(--text-dim); font-size:0.85rem;">' + new Date(r.created_at).toLocaleString() + '</td>' +
                            '<td>' +
                                '<div class="action-menu">' +
                                    '<button class="dots-btn" onclick="InspectionsModule.toggleDropdown(event, ' + r.id + ')">...</button>' +
                                    '<div id="dropdown-' + r.id + '" class="dropdown-content">' +
                                        '<button onclick="InspectionsModule.openEditModal(' + r.id + ', \'' + escapeHtml(r.passport) + '\', \'' + escapeHtml(r.discord_id || '') + '\', \'' + jsSafeResult + '\')">' +
                                            '<i class="fas fa-pencil-alt"></i> Редактировать' +
                                        '</button>' +
                                    '</div>' +
                                '</div>' +
                            '</td>' +
                            '</tr>';
                    }).join('');
                } else {
                    list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-dim);">Записи не найдены</td></tr>';
                }
                updatePaginationUI();
            } else {
                list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--danger);">Ошибка загрузки данных</td></tr>';
            }
        } catch(e) {
            console.error(e);
            document.getElementById('reportsList').innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--danger);">Сбой при запросе к базе</td></tr>';
        }
    }

    function updatePaginationUI() {
        document.getElementById('prevBtn').disabled = currentPage === 0;
        document.getElementById('nextBtn').disabled = (totalPages === 0 || currentPage >= totalPages - 1);
        document.getElementById('pageInfo').innerText = (totalPages > 0 ? currentPage + 1 : 0) + ' из ' + totalPages;
    }

    function previousPage() {
        if (currentPage > 0) {
            currentPage--;
            loadReports();
        }
    }

    function nextPage() {
        if (currentPage < totalPages - 1) {
            currentPage++;
            loadReports();
        }
    }

    function openEditModal(id, passport, discordId, result) {
        document.getElementById('editId').value = id;
        document.getElementById('editPassport').value = passport;
        document.getElementById('editDiscordId').value = discordId === '—' ? '' : discordId;
        let decodedResult = result
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\');
        document.getElementById('editResult').value = decodedResult;
        document.getElementById('editModal').style.display = 'flex';
        
        document.querySelectorAll('.dropdown-content').forEach(el => {
            el.style.display = 'none';
        });
    }

    function closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    async function saveEdit(event) {
        event.preventDefault();
        
        const id = document.getElementById('editId').value;
        const discordId = document.getElementById('editDiscordId').value;
        const result = document.getElementById('editResult').value;
        
        try {
            const res = await fetch('/api/inspections/update/' + id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    discord_id: discordId,
                    result: result
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                showToast('Запись успешно обновлена');
                closeEditModal();
                loadReports();
            } else {
                showToast('Ошибка при обновлении', true);
            }
        } catch(e) {
            console.error(e);
            showToast('Ошибка при сохранении изменений', true);
        }
    }

    return {
        searchRecords,
        toggleDropdown,
        openEditModal,
        closeEditModal,
        saveEdit,
        previousPage,
        nextPage
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                InspectionsModule.searchRecords();
            }
        });
    }
    
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.action-menu')) {
            document.querySelectorAll('.dropdown-content').forEach(el => {
                el.style.display = 'none';
            });
        }
    });
    
    window.InspectionsModule = InspectionsModule;
    window.searchRecords = InspectionsModule.searchRecords;
    window.previousPage = InspectionsModule.previousPage;
    window.nextPage = InspectionsModule.nextPage;
    window.toggleDropdown = InspectionsModule.toggleDropdown;
    window.openEditModal = InspectionsModule.openEditModal;
    window.closeEditModal = InspectionsModule.closeEditModal;
    window.saveEdit = InspectionsModule.saveEdit;
});