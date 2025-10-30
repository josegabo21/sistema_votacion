// Configuración de Supabase
const SUPABASE_URL = 'https://nxskzqilyoxmksqdmqdb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c2t6cWlseW94bWtzcWRtcWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2ODk2MjUsImV4cCI6MjA3NTI2NTYyNX0.HhLiBQhRELS9XyS6s0QlBunNRP_vArmNNuhlVD9DiwM';

// Service Role Key para operaciones admin
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c2t6cWlseW94bWtzcWRtcWRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTY4OTYyNSwiZXhwIjoyMDc1MjY1NjI1fQ.TWQFkh3VosdHQAc83dfJH0CcHQG7rusqHsrclhD8lxY';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Contraseñas
const ADMIN_PASSWORD = "chupalo_12345678";
const RESULTS_PASSWORD = "resultados_expoferia";

// Cache para datos
let participantsCache = null;
let voteResultsCache = null;
let appConfigCache = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 30000; // 30 segundos

// Elementos del DOM
const adminModal = document.getElementById('admin-modal');
const adminToggle = document.getElementById('admin-toggle');
const closeModal = document.querySelector('.close-modal');
const adminLogin = document.getElementById('admin-login');
const adminMain = document.getElementById('admin-main');
const loginBtn = document.getElementById('login-btn');
const loginMessage = document.getElementById('login-message');
const participantForm = document.getElementById('participant-form');
const participantsList = document.getElementById('participants-list');
const voteOptions = document.getElementById('vote-options');
const submitVoteBtn = document.getElementById('submit-vote');
const resultsContainer = document.getElementById('results-container');
const topThreeContainer = document.getElementById('top-three');
const voteMessage = document.getElementById('vote-message');
const adminStats = document.getElementById('admin-stats');
const resetVotesBtn = document.getElementById('reset-votes');
const imageUpload = document.getElementById('image-upload');
const participantImage = document.getElementById('participant-image');
const imagePreview = document.getElementById('image-preview');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const resultsLogin = document.getElementById('results-login');
const resultsContent = document.getElementById('results-content');
const resultsLoginBtn = document.getElementById('results-login-btn');
const resultsLoginMessage = document.getElementById('results-login-message');
const publicResultsToggle = document.getElementById('public-results-toggle');
const publicResultsStatus = document.getElementById('public-results-status');

// Variables de estado
let selectedOption = null;
let currentImage = null;
let editingParticipantId = null;
let isLoading = false;
let currentPublicResultsState = false;

// Generar un ID único para el votante
function getVoterId() {
    let voterId = localStorage.getItem('voterId');
    if (!voterId) {
        voterId = 'voter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('voterId', voterId);
    }
    return voterId;
}

// Funciones de utilidad
function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `alert alert-${type}`;
    element.style.display = 'block';
    
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function showLoading(element) {
    element.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--gray);">Cargando...</div>';
}

function hideElement(element) {
    element.style.display = 'none';
}

function showElement(element) {
    element.style.display = 'block';
}

// Funciones para manejo de imágenes
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentImage = e.target.result;
            imagePreview.src = currentImage;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Funciones para configuración de la aplicación
async function getAppConfig(forceRefresh = false) {
    const now = Date.now();
    
    if (appConfigCache && !forceRefresh && (now - lastCacheUpdate) < CACHE_DURATION) {
        return appConfigCache;
    }
    
    try {
        const { data, error } = await supabase
            .from('app_config')
            .select('*')
            .eq('id', '00000000-0000-0000-0000-000000000000')
            .single();
        
        if (error) {
            // Si no existe la configuración, crear una por defecto
            if (error.code === 'PGRST116') {
                const defaultConfig = { public_results: false };
                await createDefaultConfig();
                return defaultConfig;
            }
            throw error;
        }
        
        appConfigCache = data || { public_results: false };
        currentPublicResultsState = appConfigCache.public_results;
        lastCacheUpdate = now;
        return appConfigCache;
    } catch (error) {
        console.error('Error loading app config:', error);
        return { public_results: false };
    }
}

async function createDefaultConfig() {
    try {
        const { error } = await supabaseAdmin
            .from('app_config')
            .insert([
                { 
                    id: '00000000-0000-0000-0000-000000000000',
                    public_results: false
                }
            ]);
        
        if (error) throw error;
        console.log('Configuración por defecto creada');
    } catch (error) {
        console.error('Error creating default config:', error);
    }
}

async function updatePublicResultsStatus(isPublic) {
    if (isLoading) return;
    isLoading = true;
    
    try {
        const { error } = await supabaseAdmin
            .from('app_config')
            .update({ public_results: isPublic })
            .eq('id', '00000000-0000-0000-0000-000000000000');
        
        if (error) throw error;
        
        // Actualizar cache y estado
        appConfigCache = { public_results: isPublic };
        currentPublicResultsState = isPublic;
        
        // Actualizar UI
        updatePublicResultsUI(isPublic);
        
        showMessage(voteMessage, `Resultados ${isPublic ? 'públicos' : 'privados'} configurados correctamente`, 'success');
        
        // Si estamos en la pestaña de resultados, actualizar la vista
        if (document.getElementById('results').classList.contains('active')) {
            await handleResultsTabActivation();
        }
        
    } catch (error) {
        console.error('Error updating public results:', error);
        showMessage(voteMessage, 'Error al actualizar configuración: ' + error.message, 'error');
        // Revertir el toggle en caso de error
        publicResultsToggle.checked = !isPublic;
    } finally {
        isLoading = false;
    }
}

function updatePublicResultsUI(isPublic) {
    publicResultsToggle.checked = isPublic;
    
    if (isPublic) {
        publicResultsStatus.textContent = 'Resultados PÚBLICOS';
        publicResultsStatus.className = 'status-public';
    } else {
        publicResultsStatus.textContent = 'Resultados PRIVADOS';
        publicResultsStatus.className = 'status-private';
    }
}

// Manejar la activación de la pestaña de resultados
async function handleResultsTabActivation() {
    const config = await getAppConfig();
    
    if (config.public_results) {
        // Si los resultados son públicos, mostrar directamente
        resultsLogin.style.display = 'none';
        resultsContent.style.display = 'block';
        await renderResults();
    } else {
        // Si son privados, mostrar login
        resultsLogin.style.display = 'block';
        resultsContent.style.display = 'none';
    }
}

// Funciones para participantes con cache
async function loadParticipants(forceRefresh = false) {
    const now = Date.now();
    
    if (participantsCache && !forceRefresh && (now - lastCacheUpdate) < CACHE_DURATION) {
        return participantsCache;
    }
    
    try {
        showLoading(participantsList);
        const { data, error } = await supabase
            .from('participants')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        participantsCache = data || [];
        lastCacheUpdate = now;
        return participantsCache;
    } catch (error) {
        console.error('Error loading participants:', error);
        showMessage(voteMessage, 'Error al cargar proyectos', 'error');
        return [];
    }
}

async function addParticipant(name, description, image) {
    if (isLoading) return;
    isLoading = true;
    
    try {
        console.log('Agregando participante:', { name, description });
        
        const { data, error } = await supabaseAdmin
            .from('participants')
            .insert([
                { 
                    name: name, 
                    description: description,
                    image_url: image
                }
            ])
            .select();
        
        if (error) {
            console.error('Error de Supabase:', error);
            throw error;
        }
        
        console.log('Participante agregado:', data);
        showMessage(voteMessage, 'Proyecto agregado correctamente', 'success');
        
        // Invalidar cache
        participantsCache = null;
        voteResultsCache = null;
        
        await refreshAllData();
        
        // Limpiar formulario
        document.getElementById('participant-name').value = '';
        document.getElementById('participant-description').value = '';
        imagePreview.style.display = 'none';
        currentImage = null;
        participantImage.value = '';
        
    } catch (error) {
        console.error('Error completo adding participant:', error);
        showMessage(voteMessage, 'Error al agregar proyecto: ' + error.message, 'error');
    } finally {
        isLoading = false;
    }
}

async function updateParticipant(id, name, description, image) {
    if (isLoading) return;
    isLoading = true;
    
    try {
        console.log('Actualizando participante:', { id, name, description });
        
        const updateData = { 
            name: name, 
            description: description
        };
        
        if (image) {
            updateData.image_url = image;
        }
        
        const { error } = await supabaseAdmin
            .from('participants')
            .update(updateData)
            .eq('id', id);
        
        if (error) throw error;
        
        showMessage(voteMessage, 'Proyecto actualizado correctamente', 'success');
        
        // Invalidar cache
        participantsCache = null;
        voteResultsCache = null;
        
        await refreshAllData();
        
        // Limpiar formulario y resetear estado
        resetParticipantForm();
        
    } catch (error) {
        console.error('Error updating participant:', error);
        showMessage(voteMessage, 'Error al actualizar proyecto: ' + error.message, 'error');
    } finally {
        isLoading = false;
    }
}

async function deleteParticipant(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este proyecto? También se eliminarán todos sus votos.')) return;
    
    if (isLoading) return;
    isLoading = true;
    
    try {
        console.log('Eliminando participante:', id);
        
        const { error } = await supabaseAdmin
            .from('participants')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showMessage(voteMessage, 'Proyecto eliminado correctamente', 'success');
        
        // Invalidar cache
        participantsCache = null;
        voteResultsCache = null;
        
        await refreshAllData();
        
    } catch (error) {
        console.error('Error deleting participant:', error);
        showMessage(voteMessage, 'Error al eliminar proyecto: ' + error.message, 'error');
    } finally {
        isLoading = false;
    }
}

function resetParticipantForm() {
    document.getElementById('participant-name').value = '';
    document.getElementById('participant-description').value = '';
    imagePreview.style.display = 'none';
    currentImage = null;
    participantImage.value = '';
    editingParticipantId = null;
    
    // Restaurar el botón
    const submitButton = participantForm.querySelector('button');
    submitButton.textContent = 'Agregar Proyecto';
    submitButton.className = 'btn-success';
}

function renderParticipants(participants) {
    participantsList.innerHTML = '';
    
    if (participants.length === 0) {
        participantsList.innerHTML = '<tr><td colspan="4" style="text-align: center;">No hay proyectos registrados</td></tr>';
        return;
    }
    
    participants.forEach(participant => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                ${participant.image_url ? 
                    `<img src="${participant.image_url}" class="result-image" alt="${participant.name}" loading="lazy">` : 
                    '<div class="result-image" style="background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #94a3b8;">Sin imagen</div>'
                }
            </td>
            <td>${participant.name}</td>
            <td>${participant.description}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-warning" onclick="editParticipant('${participant.id}')">Editar</button>
                    <button class="btn-danger" onclick="deleteParticipant('${participant.id}')">Eliminar</button>
                </div>
            </td>
        `;
        participantsList.appendChild(row);
    });
}

// Funciones para votación
async function renderVoteOptions() {
    const participants = await loadParticipants();
    voteOptions.innerHTML = '';
    
    if (participants.length === 0) {
        voteOptions.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--gray);">No hay proyectos para votar. Contacta al administrador.</p>';
        submitVoteBtn.style.display = 'none';
        return;
    }
    
    submitVoteBtn.style.display = 'block';
    
    // Verificar si ya votó (no bloqueante)
    checkIfVoted().then(hasVoted => {
        if (hasVoted) {
            submitVoteBtn.disabled = true;
            submitVoteBtn.textContent = 'Ya has votado';
        } else {
            submitVoteBtn.disabled = false;
            submitVoteBtn.textContent = 'Confirmar Voto';
        }
        
        renderVoteOptionsList(participants, hasVoted);
    });
}

function renderVoteOptionsList(participants, hasVoted) {
    participants.forEach(participant => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'vote-option';
        optionDiv.setAttribute('data-id', participant.id);
        optionDiv.innerHTML = `
            ${participant.image_url ? 
                `<img src="${participant.image_url}" class="option-image" alt="${participant.name}" loading="lazy">` : 
                '<div class="option-image" style="background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8;">Sin imagen</div>'
            }
            <div class="option-content">
                <div class="option-name">${participant.name}</div>
                <div class="option-description">${participant.description}</div>
            </div>
            <div class="vote-check"></div>
        `;
        
        if (!hasVoted) {
            optionDiv.addEventListener('click', () => {
                // Deseleccionar todas las opciones
                document.querySelectorAll('.vote-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Seleccionar la opción actual
                optionDiv.classList.add('selected');
                selectedOption = participant.id;
            });
        } else {
            optionDiv.style.pointerEvents = 'none';
            optionDiv.style.opacity = '0.7';
        }
        
        voteOptions.appendChild(optionDiv);
    });
}

async function checkIfVoted() {
    try {
        const voterId = getVoterId();
        const { data, error } = await supabase
            .from('votes')
            .select('id')
            .eq('voter_id', voterId)
            .maybeSingle();
        
        if (error) throw error;
        return !!data;
    } catch (error) {
        console.error('Error checking vote:', error);
        return false;
    }
}

async function submitVote() {
    if (!selectedOption) {
        showMessage(voteMessage, 'Por favor, selecciona un proyecto para votar.', 'error');
        return;
    }
    
    if (isLoading) return;
    isLoading = true;
    
    try {
        // Verificar si ya se ha votado
        const hasVoted = await checkIfVoted();
        if (hasVoted) {
            showMessage(voteMessage, 'Ya has emitido tu voto. Solo se permite un voto por dispositivo.', 'error');
            return;
        }
        
        const voterId = getVoterId();
        const { error } = await supabase
            .from('votes')
            .insert([
                { 
                    participant_id: selectedOption,
                    voter_id: voterId
                }
            ]);
        
        if (error) throw error;
        
        showMessage(voteMessage, '¡Tu voto ha sido registrado correctamente!', 'success');
        
        // Invalidar cache
        voteResultsCache = null;
        
        await refreshAllData();
        
    } catch (error) {
        console.error('Error submitting vote:', error);
        showMessage(voteMessage, 'Error al registrar el voto: ' + error.message, 'error');
    } finally {
        isLoading = false;
    }
}

// Funciones para resultados con cache
async function getVoteResults(forceRefresh = false) {
    const now = Date.now();
    
    if (voteResultsCache && !forceRefresh && (now - lastCacheUpdate) < CACHE_DURATION) {
        return voteResultsCache;
    }
    
    try {
        const { data, error } = await supabase
            .from('votes')
            .select(`
                participant_id,
                participants (
                    id,
                    name,
                    description,
                    image_url
                )
            `);
        
        if (error) throw error;
        
        // Contar votos por participante
        const voteCounts = {};
        if (data) {
            data.forEach(vote => {
                const participantId = vote.participant_id;
                if (!voteCounts[participantId]) {
                    voteCounts[participantId] = {
                        participant: vote.participants,
                        votes: 0
                    };
                }
                voteCounts[participantId].votes++;
            });
        }
        
        voteResultsCache = voteCounts;
        lastCacheUpdate = now;
        return voteCounts;
    } catch (error) {
        console.error('Error getting vote results:', error);
        return {};
    }
}

async function renderResults() {
    showLoading(resultsContainer);
    showLoading(topThreeContainer);
    
    try {
        const [voteCounts, participants] = await Promise.all([
            getVoteResults(),
            loadParticipants()
        ]);
        
        renderResultsContent(voteCounts, participants);
    } catch (error) {
        console.error('Error rendering results:', error);
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 40px;">Error al cargar resultados.</p>';
    }
}

function renderResultsContent(voteCounts, participants) {
    resultsContainer.innerHTML = '';
    topThreeContainer.innerHTML = '';
    
    if (participants.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 40px;">No hay proyectos para mostrar resultados.</p>';
        return;
    }
    
    // Preparar datos para ordenar
    const results = participants.map(participant => {
        const votesData = voteCounts[participant.id] || { votes: 0, participant: participant };
        return {
            ...participant,
            votes: votesData.votes
        };
    });
    
    // Ordenar por número de votos (de mayor a menor)
    const sortedResults = results.sort((a, b) => b.votes - a.votes);
    
    // Calcular el total de votos
    const totalVotes = sortedResults.reduce((sum, result) => sum + result.votes, 0);
    
    // Mostrar top 3
    const topThree = sortedResults.slice(0, 3);
    topThree.forEach((result, index) => {
        const percentage = totalVotes > 0 ? ((result.votes / totalVotes) * 100).toFixed(1) : 0;
        
        const topDiv = document.createElement('div');
        topDiv.className = `top-item ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'}`;
        topDiv.innerHTML = `
            <div class="top-badge">
                ${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
            </div>
            ${result.image_url ? 
                `<img src="${result.image_url}" class="result-image" alt="${result.name}" style="width: 80px; height: 80px; margin: 0 auto 10px;" loading="lazy">` : 
                '<div class="result-image" style="width: 80px; height: 80px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; margin: 0 auto 10px;">Sin imagen</div>'
            }
            <h3 style="color: var(--primary); margin-bottom: 5px;">${result.name}</h3>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--dark);">${percentage}%</div>
            <div style="color: var(--gray);">${result.votes} voto${result.votes !== 1 ? 's' : ''}</div>
        `;
        topThreeContainer.appendChild(topDiv);
    });
    
    // Mostrar todos los resultados
    sortedResults.forEach(result => {
        const percentage = totalVotes > 0 ? ((result.votes / totalVotes) * 100).toFixed(1) : 0;
        
        const resultDiv = document.createElement('div');
        resultDiv.className = 'result-item';
        resultDiv.innerHTML = `
            <div class="result-header">
                <div class="result-info">
                    ${result.image_url ? 
                        `<img src="${result.image_url}" class="result-image" alt="${result.name}" loading="lazy">` : 
                        '<div class="result-image" style="background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8;">Sin imagen</div>'
                    }
                    <div>
                        <div style="font-weight: 600; color: var(--primary);">${result.name}</div>
                    </div>
                </div>
                <span style="font-weight: 600; color: var(--dark);">${percentage}% (${result.votes} voto${result.votes !== 1 ? 's' : ''})</span>
            </div>
            <div class="result-bar">
                <div class="result-fill" style="width: ${percentage}%">${percentage}%</div>
            </div>
        `;
        resultsContainer.appendChild(resultDiv);
    });
    
    if (totalVotes === 0) {
        resultsContainer.innerHTML += '<p style="text-align: center; margin-top: 20px; color: var(--gray);">Aún no hay votos registrados.</p>';
    }
}

// Funciones para administración
async function renderAdminStats() {
    try {
        const [participants, votesData, config] = await Promise.all([
            loadParticipants(),
            supabase.from('votes').select('id'),
            getAppConfig()
        ]);
        
        const totalVotes = votesData.data ? votesData.data.length : 0;
        const hasVoted = await checkIfVoted() ? "Sí" : "No";
        
        adminStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${totalVotes}</div>
                <div class="stat-label">Total de votos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${participants.length}</div>
                <div class="stat-label">Proyectos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${hasVoted}</div>
                <div class="stat-label">Estado de voto</div>
            </div>
        `;
        
        // Actualizar estado de resultados públicos
        updatePublicResultsUI(config.public_results);
        
    } catch (error) {
        console.error('Error loading admin stats:', error);
        adminStats.innerHTML = '<div style="text-align: center; color: var(--gray);">Error al cargar estadísticas</div>';
    }
}

async function resetVotes() {
    if (!confirm('¿Estás seguro de que deseas reiniciar toda la votación? Se eliminarán TODOS los votos y los usuarios podrán votar nuevamente.')) return;
    
    if (isLoading) return;
    isLoading = true;
    
    try {
        const { error } = await supabaseAdmin
            .from('votes')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (error) throw error;
        
        // Limpiar localStorage para permitir votar nuevamente
        localStorage.removeItem('voterId');
        
        // Invalidar cache
        participantsCache = null;
        voteResultsCache = null;
        
        await refreshAllData();
        showMessage(voteMessage, 'La votación ha sido reiniciada correctamente. Todos los votos han sido eliminados.', 'success');
        
    } catch (error) {
        console.error('Error resetting votes:', error);
        showMessage(voteMessage, 'Error al reiniciar la votación: ' + error.message, 'error');
    } finally {
        isLoading = false;
    }
}

// Función para refrescar todos los datos de forma optimizada
async function refreshAllData() {
    try {
        // Cargar datos en paralelo cuando sea posible
        const [participants, config] = await Promise.all([
            loadParticipants(true), // force refresh
            getAppConfig(true)
        ]);
        
        // Renderizar componentes de forma secuencial para mejor UX
        renderParticipants(participants);
        await renderVoteOptions();
        await renderAdminStats();
        
        // Si estamos en la pestaña de resultados, actualizar la vista
        if (document.getElementById('results').classList.contains('active')) {
            await handleResultsTabActivation();
        }
        
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
}

// Funciones de edición
window.editParticipant = async function(id) {
    const participants = await loadParticipants();
    const participant = participants.find(p => p.id === id);
    
    if (participant) {
        document.getElementById('participant-name').value = participant.name;
        document.getElementById('participant-description').value = participant.description;
        if (participant.image_url) {
            currentImage = participant.image_url;
            imagePreview.src = currentImage;
            imagePreview.style.display = 'block';
        }
        editingParticipantId = id;
        
        // Cambiar el texto del botón
        const submitButton = participantForm.querySelector('button');
        submitButton.textContent = 'Actualizar Proyecto';
        submitButton.className = 'btn-warning';
    }
}

// Sistema de pestañas y event listeners optimizados
tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
        const tabId = tab.getAttribute('data-tab');
        
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        // Cargar datos específicos de la pestaña cuando se activa
        if (tabId === 'results') {
            await handleResultsTabActivation();
        }
    });
});

// Event listeners optimizados
participantForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('participant-name').value.trim();
    const description = document.getElementById('participant-description').value.trim();
    
    if (name && description) {
        if (editingParticipantId) {
            await updateParticipant(editingParticipantId, name, description, currentImage);
        } else {
            await addParticipant(name, description, currentImage);
        }
    }
});

submitVoteBtn.addEventListener('click', submitVote);

adminToggle.addEventListener('click', () => { 
    adminModal.style.display = 'block'; 
});

closeModal.addEventListener('click', () => { 
    adminModal.style.display = 'none'; 
});

window.addEventListener('click', (e) => {
    if (e.target === adminModal) {
        adminModal.style.display = 'none';
    }
});

loginBtn.addEventListener('click', () => {
    const password = document.getElementById('admin-password').value;
    
    if (password === ADMIN_PASSWORD) {
        adminLogin.style.display = 'none';
        adminMain.style.display = 'block';
        refreshAllData();
        showMessage(loginMessage, 'Acceso concedido.', 'success');
    } else {
        showMessage(loginMessage, 'Contraseña incorrecta. Intenta nuevamente.', 'error');
    }
});

resultsLoginBtn.addEventListener('click', () => {
    const password = document.getElementById('results-password').value;
    
    if (password === RESULTS_PASSWORD) {
        resultsLogin.style.display = 'none';
        resultsContent.style.display = 'block';
        renderResults();
        showMessage(resultsLoginMessage, 'Acceso concedido.', 'success');
    } else {
        showMessage(resultsLoginMessage, 'Contraseña incorrecta. Intenta nuevamente.', 'error');
    }
});

resetVotesBtn.addEventListener('click', resetVotes);
imageUpload.addEventListener('click', () => { participantImage.click(); });
participantImage.addEventListener('change', handleImageUpload);

// Event listener para el toggle de resultados públicos
publicResultsToggle.addEventListener('change', function() {
    updatePublicResultsStatus(this.checked);
});

// Inicialización optimizada
window.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando aplicación...');
    
    // Mostrar contenido básico inmediatamente
    showLoading(participantsList);
    showLoading(voteOptions);
    
    // Cargar configuración inicial
    const config = await getAppConfig();
    updatePublicResultsUI(config.public_results);
    
    // Cargar datos iniciales de forma no bloqueante
    setTimeout(async () => {
        try {
            await refreshAllData();
            console.log('Aplicación inicializada correctamente');
        } catch (error) {
            console.error('Error durante la inicialización:', error);
        }
    }, 100);
});

// Precarga de imágenes para mejor performance
function preloadImages(participants) {
    participants.forEach(participant => {
        if (participant.image_url) {
            const img = new Image();
            img.src = participant.image_url;
        }
    });
}