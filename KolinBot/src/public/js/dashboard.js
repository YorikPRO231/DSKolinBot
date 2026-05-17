async function loadTableData(endpoint, tableId) {
    try {
        const response = await fetch(`/api/${endpoint}`);
        const data = await response.json();
        
        if (data.success && window.renderTable) {
            window.renderTable(data, tableId);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}
window.showModal = (modalId) => {
    document.getElementById(modalId).classList.add('active');
};

window.closeModal = (modalId) => {
    document.getElementById(modalId).classList.remove('active');
};

window.showError = (message) => {
    console.error(message);
};

window.showSuccess = (message) => {
    console.log(message);
};