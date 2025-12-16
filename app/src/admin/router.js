import { viewProjectSubmissions } from './submissions.js';
import { editForm } from './forms.js';
import { viewSubmission } from './submissions.js';
import { showView } from './dashboard.js';

// ======== ROUTER ========
// ============ URL ROUTING ============

function navigateTo(route, params = {}) {
    let hash = route;
    if (params.id) {
        hash += '/' + params.id;
    }
    window.location.hash = hash;
}

function parseRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const parts = hash.split('/');
    return {
        view: parts[0],
        id: parts[1] ? parseInt(parts[1], 10) : null
    };
}

async function handleRoute() {
    const route = parseRoute();

    try {
        switch (route.view) {
            case 'dashboard':
                showView('dashboard');
                break;
            case 'projects':
                showView('projects');
                break;
            case 'forms':
                showView('forms');
                break;
            case 'project':
                if (route.id && Number.isInteger(route.id) && route.id > 0) {
                    await viewProjectSubmissions(route.id, false);
                } else {
                    navigateTo('projects');
                }
                break;
            case 'form':
                if (route.id && Number.isInteger(route.id) && route.id > 0) {
                    await editForm(route.id, false);
                } else {
                    navigateTo('forms');
                }
                break;
            case 'submission':
                if (route.id && Number.isInteger(route.id) && route.id > 0) {
                    await viewSubmission(route.id, false);
                } else {
                    navigateTo('dashboard');
                }
                break;
            case 'backups':
                showView('backups');
                break;
            default:
                navigateTo('dashboard');
        }
    } catch (error) {
        console.error('Erreur de navigation:', error);
        navigateTo('dashboard');
    }
}

// Écouter les changements de hash
window.addEventListener('hashchange', handleRoute);



export { navigateTo };
export { parseRoute };
export { handleRoute };
