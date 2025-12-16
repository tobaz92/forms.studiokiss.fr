import { state } from './state.js';
import { escapeHtml, formatDate } from './utils.js';
import { api } from './api.js';

// ======== BACKUPS ========
// =============================================================================
// GESTION DES BACKUPS
// =============================================================================

async function loadBackups() {
    const container = document.getElementById('backups-list');
    container.innerHTML = '<p class="text-muted">Chargement...</p>';

    try {
        const backups = await api('/admin/backups');

        if (backups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Aucun backup disponible</p>
                    <p style="font-size: 13px; color: var(--gray-500);">Cliquez sur "Nouveau backup" pour créer une sauvegarde</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Fichier</th>
                        <th>Date</th>
                        <th>Taille</th>
                        <th style="width: 120px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${backups.map(backup => `
                        <tr>
                            <td>
                                <span style="font-family: monospace; font-size: 13px;">${escapeHtml(backup.filename)}</span>
                                ${backup.filename.includes('-scheduled-') ? '<span class="badge badge-sm" style="margin-left: 8px; background: var(--accent-light); color: var(--accent);">Auto</span>' : ''}
                                ${backup.filename.includes('-manual-') ? '<span class="badge badge-sm" style="margin-left: 8px; background: var(--gray-200); color: var(--gray-600);">Manuel</span>' : ''}
                            </td>
                            <td>${formatDate(backup.date)}</td>
                            <td>${backup.sizeFormatted}</td>
                            <td class="table-actions">
                                <button class="btn btn-sm btn-secondary" onclick="downloadBackupFile('${escapeHtml(backup.filename)}')" title="Télécharger">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteBackup('${escapeHtml(backup.filename)}')" title="Supprimer">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<p class="text-muted" style="color: var(--danger);">Erreur: ${error.message}</p>`;
    }
}

async function createBackup(e) {
    const btn = e ? e.target.closest('button') : document.querySelector('#view-backups .btn-primary');
    const originalHTML = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin" style="margin-right: 6px;">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Création...
        `;

        const result = await api('/admin/backups', { method: 'POST' });

        if (result.success) {
            // Recharger la liste
            await loadBackups();
        }
    } catch (error) {
        alert('Erreur: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

async function downloadBackupFile(filename) {
    try {
        const response = await fetch(`/api/admin/backups/${encodeURIComponent(filename)}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erreur de téléchargement');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert('Erreur: ' + error.message);
    }
}

async function deleteBackup(filename) {
    if (!window.confirm(`Supprimer le backup "${filename}" ?`)) return;

    try {
        await api(`/admin/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        await loadBackups();
    } catch (error) {
        alert('Erreur: ' + error.message);
    }
}



export { loadBackups };
export { createBackup };
export { downloadBackupFile };
export { deleteBackup };
