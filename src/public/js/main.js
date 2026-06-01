const Utils = {
    escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(str).replace(/[&<>"']/g, m => map[m]);
    },
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    },
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            if (!document.querySelector('.modal.show, .modal-blur-overlay.show')) {
                document.body.style.overflow = '';
            }
        }
    },
    
    showToast(message, isError = false) {
        const toast = document.getElementById('globalToast');
        const toastMessage = document.getElementById('globalToastMessage');
        const toastIcon = document.getElementById('globalToastIcon');
        
        if (!toast || !toastMessage) return;
        
        if (isError) {
            toast.classList.add('error');
            if (toastIcon) {
                toastIcon.className = 'fas fa-exclamation-triangle';
            }
        } else {
            toast.classList.remove('error');
            if (toastIcon) {
                toastIcon.className = 'fas fa-check-circle';
            }
        }
        
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },
    
    formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
        } catch (e) {
            return dateStr;
        }
    }
};

window.Utils = Utils;

function showModal(id) { Utils.showModal(id); }
function closeModal(id) { Utils.closeModal(id); }
function escapeHtml(str) { return Utils.escapeHtml(str); }

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.show, .modal-blur-overlay.show');
            if (activeModal) {
                activeModal.classList.remove('show');
                document.body.style.overflow = '';
            }
        }
    });

    document.querySelectorAll('.modal, .modal-blur-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
    });
});