import { state } from './state.js';
import { escapeHtml, getFieldTypeLabel, generateId, openModal, closeModal, customConfirm } from './utils.js';

// ======== EDITOR ========

// Form Editor
function renderEditor() {
    const container = document.getElementById('editor-sections');

    if (state.currentFormStructure.sections.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-title">Aucune section</div>
                <p>Ajoutez une section pour commencer à construire votre formulaire.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.currentFormStructure.sections.map((section, sIdx) => `
        <div class="editor-section" data-section="${sIdx}" draggable="true">
            <div class="editor-section-header">
                <span class="drag-handle section-handle" title="Glisser pour réordonner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                    </svg>
                </span>
                <span class="editor-section-title">${escapeHtml(section.title)}</span>
                <div class="table-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editSection(${sIdx})">Modifier</button>
                    <button class="btn btn-sm btn-secondary" onclick="addField(${sIdx})">+ Champ</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSection(${sIdx})">Supprimer</button>
                </div>
            </div>
            <div class="editor-section-body editor-fields-container" data-section="${sIdx}">
                ${section.fields.length === 0 ? '<p class="empty-fields-msg" style="color: var(--gray-500);">Aucun champ. Cliquez sur "+ Champ" pour en ajouter.</p>' : ''}
                ${section.fields.map((field, fIdx) => `
                    <div class="editor-field ${field.condition ? 'conditional' : ''}" data-field="${fIdx}" data-section="${sIdx}" draggable="true">
                        <span class="drag-handle field-handle" title="Glisser pour réordonner">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                            </svg>
                        </span>
                        <div class="editor-field-info">
                            <div class="editor-field-label">${escapeHtml(field.label)}</div>
                            <div class="editor-field-type">${escapeHtml(getFieldTypeLabel(field.type))}${field.required ? ' • Obligatoire' : ''}${field.condition ? ' • Conditionnel' : ''}</div>
                        </div>
                        <div class="editor-field-actions">
                            <button class="btn btn-sm btn-secondary" onclick="editField(${sIdx}, ${fIdx})">Modifier</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteField(${sIdx}, ${fIdx})">Supprimer</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Setup drag & drop pour sections et champs
    setupEditorDragDrop();
}

// ============ DRAG & DROP ÉDITEUR ============


function setupEditorDragDrop() {
    const container = document.getElementById('editor-sections');
    if (!container) return;

    // Drag & drop des sections
    const sections = container.querySelectorAll('.editor-section');
    sections.forEach(section => {
        section.addEventListener('dragstart', handleSectionDragStart);
        section.addEventListener('dragend', handleSectionDragEnd);
        section.addEventListener('dragover', handleSectionDragOver);
        section.addEventListener('drop', handleSectionDrop);
    });

    // Drag & drop des champs
    const fields = container.querySelectorAll('.editor-field');
    fields.forEach(field => {
        field.addEventListener('dragstart', handleFieldDragStart);
        field.addEventListener('dragend', handleFieldDragEnd);
    });

    // Zones de drop pour les champs (les containers de section)
    const fieldContainers = container.querySelectorAll('.editor-fields-container');
    fieldContainers.forEach(fc => {
        fc.addEventListener('dragover', handleFieldDragOver);
        fc.addEventListener('drop', handleFieldDrop);
        fc.addEventListener('dragleave', handleFieldDragLeave);
    });
}

// === SECTIONS ===

function handleSectionDragStart(e) {
    // Ne pas déclencher si on drag un champ
    if (e.target.classList.contains('editor-field')) {
        return;
    }
    state.draggedSection = this;
    state.draggedField = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'section');
    setTimeout(() => this.classList.add('dragging'), 0);
}

function handleSectionDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.editor-section').forEach(s => s.classList.remove('drag-over'));
    if (state.draggedSection) {
        applyNewSectionOrder();
    }
    state.draggedSection = null;
}

function handleSectionDragOver(e) {
    if (!state.draggedSection || state.draggedField) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const section = this;
    if (section === state.draggedSection) return;

    const rect = section.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const container = document.getElementById('editor-sections');

    document.querySelectorAll('.editor-section').forEach(s => s.classList.remove('drag-over'));
    section.classList.add('drag-over');

    if (e.clientY < midY) {
        container.insertBefore(state.draggedSection, section);
    } else {
        container.insertBefore(state.draggedSection, section.nextSibling);
    }
}

function handleSectionDrop(e) {
    e.preventDefault();
    e.stopPropagation();
}

function applyNewSectionOrder() {
    const container = document.getElementById('editor-sections');
    if (!container) return;
    const sectionElements = container.querySelectorAll('.editor-section');
    const newSections = [];

    sectionElements.forEach(el => {
        const oldIdx = parseInt(el.dataset.section);
        if (!isNaN(oldIdx) && state.currentFormStructure.sections[oldIdx]) {
            newSections.push(state.currentFormStructure.sections[oldIdx]);
        }
    });

    if (newSections.length === state.currentFormStructure.sections.length) {
        state.currentFormStructure.sections = newSections;
        renderEditor();
    }
}

// === CHAMPS ===

function handleFieldDragStart(e) {
    e.stopPropagation(); // Ne pas déclencher le drag de la section parent
    state.draggedField = this;
    state.draggedSection = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'field');
    setTimeout(() => this.classList.add('dragging'), 0);
}

function handleFieldDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.editor-field').forEach(f => f.classList.remove('drag-over'));
    document.querySelectorAll('.editor-fields-container').forEach(c => c.classList.remove('drag-over-container'));
    if (state.draggedField) {
        applyNewFieldOrder();
    }
    state.draggedField = null;
}

function handleFieldDragOver(e) {
    if (!state.draggedField) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const container = this;
    container.classList.add('drag-over-container');

    // Trouver le champ le plus proche
    const fields = [...container.querySelectorAll('.editor-field:not(.dragging)')];
    const afterElement = getFieldInsertPosition(container, e.clientY);

    document.querySelectorAll('.editor-field').forEach(f => f.classList.remove('drag-over'));

    if (afterElement) {
        afterElement.classList.add('drag-over');
        container.insertBefore(state.draggedField, afterElement);
    } else {
        // Insérer à la fin
        container.appendChild(state.draggedField);
    }
}

function handleFieldDragLeave(e) {
    this.classList.remove('drag-over-container');
}

function handleFieldDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('drag-over-container');
}

function getFieldInsertPosition(container, y) {
    const fields = [...container.querySelectorAll('.editor-field:not(.dragging)')];

    for (const field of fields) {
        const rect = field.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (y < midY) {
            return field;
        }
    }
    return null;
}

function applyNewFieldOrder() {
    const container = document.getElementById('editor-sections');
    if (!container) return;
    const fieldContainers = container.querySelectorAll('.editor-fields-container');

    // Construire la nouvelle structure
    const newSections = state.currentFormStructure.sections.map(section => ({
        ...section,
        fields: []
    }));

    fieldContainers.forEach(fc => {
        const sectionIdx = parseInt(fc.dataset.section);
        if (isNaN(sectionIdx) || !newSections[sectionIdx]) return;

        const fieldElements = fc.querySelectorAll('.editor-field');
        fieldElements.forEach(fieldEl => {
            const oldSectionIdx = parseInt(fieldEl.dataset.section);
            const oldFieldIdx = parseInt(fieldEl.dataset.field);

            if (!isNaN(oldSectionIdx) && !isNaN(oldFieldIdx)) {
                const field = state.currentFormStructure.sections[oldSectionIdx]?.fields[oldFieldIdx];
                if (field) {
                    newSections[sectionIdx].fields.push(field);
                }
            }
        });
    });

    state.currentFormStructure.sections = newSections;
    renderEditor();
}

function addSection() {
    state.editingSectionIndex = null;
    document.getElementById('modal-section-title').textContent = 'Nouvelle section';
    document.getElementById('section-title-input').value = '';
    openModal('modal-section');
}

function editSection(idx) {
    state.editingSectionIndex = idx;
    const section = state.currentFormStructure.sections[idx];
    document.getElementById('modal-section-title').textContent = 'Modifier la section';
    document.getElementById('section-title-input').value = section.title;
    openModal('modal-section');
}

function saveSection() {
    const title = document.getElementById('section-title-input').value.trim();
    if (!title) {
        alert('Le titre est requis');
        return;
    }

    if (state.editingSectionIndex !== null) {
        state.currentFormStructure.sections[state.editingSectionIndex].title = title;
    } else {
        state.currentFormStructure.sections.push({
            id: generateId(title),
            title,
            fields: []
        });
    }

    closeModal('modal-section');
    renderEditor();
}

function deleteSection(idx) {
    customConfirm('Supprimer cette section et tous ses champs ?', () => {
        state.currentFormStructure.sections.splice(idx, 1);
        renderEditor();
    });
}

function addField(sectionIdx) {
    state.editingSectionIndex = sectionIdx;
    state.editingFieldIndex = null;

    document.getElementById('modal-field-title').textContent = 'Ajouter un champ';
    document.getElementById('field-label-input').value = '';
    document.getElementById('field-type-select').value = 'text';
    document.getElementById('field-options-input').value = '';
    document.getElementById('field-required-input').checked = false;
    document.getElementById('field-condition-field').value = '';
    document.getElementById('field-condition-value').value = '';

    updateConditionFieldSelect(sectionIdx);
    toggleFieldOptions();
    openModal('modal-field');
}

function editField(sectionIdx, fieldIdx) {
    state.editingSectionIndex = sectionIdx;
    state.editingFieldIndex = fieldIdx;

    const field = state.currentFormStructure.sections[sectionIdx].fields[fieldIdx];

    document.getElementById('modal-field-title').textContent = 'Modifier le champ';
    document.getElementById('field-label-input').value = field.label;
    document.getElementById('field-type-select').value = field.type;
    document.getElementById('field-options-input').value = (field.options || []).join('\n');
    document.getElementById('field-required-input').checked = field.required || false;

    updateConditionFieldSelect(sectionIdx, fieldIdx);

    if (field.condition) {
        document.getElementById('field-condition-field').value = field.condition.field;
        document.getElementById('field-condition-value').value = field.condition.value;
    } else {
        document.getElementById('field-condition-field').value = '';
        document.getElementById('field-condition-value').value = '';
    }

    toggleFieldOptions();
    toggleConditionValue();
    openModal('modal-field');
}

function updateConditionFieldSelect(sectionIdx, excludeFieldIdx = null) {
    const select = document.getElementById('field-condition-field');
    let options = '<option value="">Toujours visible</option>';

    state.currentFormStructure.sections.forEach((section, sIdx) => {
        section.fields.forEach((field, fIdx) => {
            if (sIdx === sectionIdx && fIdx === excludeFieldIdx) return;
            if (['radio', 'select', 'checkbox'].includes(field.type)) {
                options += `<option value="${escapeHtml(field.id)}">${escapeHtml(field.label)}</option>`;
            }
        });
    });

    select.innerHTML = options;
}

function toggleFieldOptions() {
    const type = document.getElementById('field-type-select').value;
    const showOptions = ['select', 'radio', 'checkbox'].includes(type);
    document.getElementById('field-options-group').style.display = showOptions ? 'block' : 'none';
}

function toggleConditionValue() {
    const fieldId = document.getElementById('field-condition-field').value;
    document.getElementById('field-condition-value-group').style.display = fieldId ? 'block' : 'none';
}

document.getElementById('field-condition-field')?.addEventListener('change', toggleConditionValue);

function saveField() {
    const label = document.getElementById('field-label-input').value.trim();
    const type = document.getElementById('field-type-select').value;
    const optionsText = document.getElementById('field-options-input').value;
    const required = document.getElementById('field-required-input').checked;
    const conditionField = document.getElementById('field-condition-field').value;
    const conditionValue = document.getElementById('field-condition-value').value;

    if (!label) {
        alert('Le label est requis');
        return;
    }

    const field = {
        id: state.editingFieldIndex !== null
            ? state.currentFormStructure.sections[state.editingSectionIndex].fields[state.editingFieldIndex].id
            : generateId(label),
        label,
        type,
        required
    };

    if (['select', 'radio', 'checkbox'].includes(type)) {
        field.options = optionsText.split('\n').map(o => o.trim()).filter(o => o);
        if (field.options.length === 0) {
            alert('Au moins une option est requise');
            return;
        }
    }

    if (conditionField) {
        field.condition = {
            field: conditionField,
            value: conditionValue
        };
    }

    if (state.editingFieldIndex !== null) {
        state.currentFormStructure.sections[state.editingSectionIndex].fields[state.editingFieldIndex] = field;
    } else {
        state.currentFormStructure.sections[state.editingSectionIndex].fields.push(field);
    }

    closeModal('modal-field');
    renderEditor();
}

function deleteField(sectionIdx, fieldIdx) {
    customConfirm('Supprimer ce champ ?', () => {
        state.currentFormStructure.sections[sectionIdx].fields.splice(fieldIdx, 1);
        renderEditor();
    });
}


export { renderEditor };
export { setupEditorDragDrop };
export { handleSectionDragStart };
export { handleSectionDragEnd };
export { handleSectionDragOver };
export { handleSectionDrop };
export { applyNewSectionOrder };
export { handleFieldDragStart };
export { handleFieldDragEnd };
export { handleFieldDragOver };
export { handleFieldDragLeave };
export { handleFieldDrop };
export { getFieldInsertPosition };
export { applyNewFieldOrder };
export { addSection };
export { editSection };
export { saveSection };
export { deleteSection };
export { addField };
export { editField };
export { updateConditionFieldSelect };
export { toggleFieldOptions };
export { toggleConditionValue };
export { saveField };
export { deleteField };
