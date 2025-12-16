export function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return str.replace(/[&<>"']/g, m => map[m]);
}

export function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

export function getStatusLabel(status) {
    return { draft: 'Brouillon', submitted: 'Soumis', validated: 'Validé', archived: 'Archivé', active: 'Actif', inactive: 'Inactif' }[status] || status;
}

export function getFieldTypeLabel(type) {
    return { text: 'Texte court', email: 'Email', tel: 'Téléphone', textarea: 'Texte long', date: 'Date', select: 'Liste déroulante', radio: 'Choix unique', checkbox: 'Choix multiples' }[type] || type;
}

export function generateId(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').substring(0, 50);
}

export function openModal(id) { document.getElementById(id).classList.add('active'); }
export function closeModal(id) { document.getElementById(id).classList.remove('active'); }

export function customConfirm(message, callback) {
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-btn').onclick = () => { closeModal('modal-confirm'); if (typeof callback === 'function') callback(); };
    openModal('modal-confirm');
}
