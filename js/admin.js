import { auth, playersRef, teamsRef, matchHistoryRef, settingsRef, onAuthStateChanged, signInAnonymously, onSnapshot, doc, deleteDoc, addDoc, updateDoc, setDoc } from './firebase.js';
import { state } from './state.js';
import { renderAll, switchView, showToast, openConfirmModal, renderSorteioTable, updateSorteioCounters } from './ui.js';
import { checkWinCondition } from './logic.js';

export const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('photoPreview').src = e.target.result;
            document.getElementById('photoPreview').classList.remove('hidden');
            document.getElementById('photoPlaceholder').classList.add('hidden');
            document.getElementById('photoData').value = e.target.result;
            document.getElementById('btnRemovePhoto').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
};

export const removePhoto = () => {
    const preview = document.getElementById('photoPreview');
    if(preview) {
        preview.src = '';
        preview.classList.add('hidden');
    }
    const placeholder = document.getElementById('photoPlaceholder');
    if(placeholder) placeholder.classList.remove('hidden');
    
    const dataInput = document.getElementById('photoData');
    if(dataInput) dataInput.value = '';
    
    const fileInput = document.getElementById('playerPhoto');
    if(fileInput) fileInput.value = '';
    
    const btnRemove = document.getElementById('btnRemovePhoto');
    if(btnRemove) btnRemove.classList.add('hidden');
};

onAuthStateChanged(auth, (user) => {
    if (user) { 
        document.getElementById('loading-overlay').classList.add('hidden'); 
        
        onSnapshot(playersRef, (s) => { 
            state.players = s.docs.map(d => ({id: d.id, ...d.data()})); 
            if(state.isFirstLoad) { 
                state.players.forEach(p => state.selectedPlayerIds.add(p.id)); 
                state.isFirstLoad = false; 
            } 
            renderAll(); 
        });
        
        onSnapshot(teamsRef, (s) => { 
            state.drawnTeams = s.docs.map(d => ({id: d.id, ...d.data()})); 
            renderAll(); 
        });
        
        onSnapshot(matchHistoryRef, (s) => { 
            state.matchHistory = s.docs.map(d => ({id: d.id, ...d.data()})); 
            renderAll(); 
        });
        
        onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                state.eloEnabled = data.eloEnabled;
                const toggle = document.getElementById('toggleElo');
                if (toggle) toggle.checked = state.eloEnabled;

                let needsPreviewUpdate = false;

                if (data.team1 !== undefined) {
                    state.currentTeam1 = data.team1;
                    const t1 = document.getElementById('team1Select');
                    if (t1 && t1.value !== data.team1) { t1.value = data.team1; needsPreviewUpdate = true; }
                }
                
                if (data.team2 !== undefined) {
                    state.currentTeam2 = data.team2;
                    const t2 = document.getElementById('team2Select');
                    if (t2 && t2.value !== data.team2) { t2.value = data.team2; needsPreviewUpdate = true; }
                }

                if (data.score1 !== undefined) {
                    state.score1 = data.score1;
                    const s1 = document.getElementById('score1');
                    if (s1) s1.innerText = state.score1;
                }
                if (data.score2 !== undefined) {
                    state.score2 = data.score2;
                    const s2 = document.getElementById('score2');
                    if (s2) s2.innerText = state.score2;
                }

                if (typeof checkWinCondition === 'function') {
                    checkWinCondition();
                }

                if (state.score1 === 0 && state.score2 === 0) {
                    const vicModal = document.getElementById('victoryModal');
                    if (vicModal && vicModal.classList.contains('flex')) {
                        vicModal.classList.add('hidden');
                        vicModal.classList.remove('flex');
                    }
                }
            }
        });
    }
});

signInAnonymously(auth);

export const toggleEloSystem = async (enabled) => {
    if (!state.isAuthenticated) { 
        showToast("Apenas admins podem alterar isso.", "error"); 
        return; 
    }
    await setDoc(settingsRef, { eloEnabled: enabled }, { merge: true });
    showToast(enabled ? "Placar Público Ativado!" : "Placar Público Desativado!", "info");
};

export const handleLogin = () => { 
    if(document.getElementById('loginUser').value === 'admin' && document.getElementById('loginPass').value === '12345') { 
        state.isAuthenticated = true; 
        switchView('admin'); 
        showToast("Sessão iniciada."); 
    } else {
        showToast("Negado!", "error");
    }
};

export const handleLogout = () => { 
    state.isAuthenticated = false; 
    switchView('sorteio'); 
    showToast("Sessão terminada."); 
};

export const togglePlayerSelection = (id, isC) => { 
    isC ? state.selectedPlayerIds.add(id) : state.selectedPlayerIds.delete(id); 
};

export const toggleAllPlayers = (isC) => { 
    isC ? state.players.forEach(p => state.selectedPlayerIds.add(p.id)) : state.selectedPlayerIds.clear(); 
    renderSorteioTable(); 
};

export const selectOnlyPlayersInTeams = () => {
    state.selectedPlayerIds.clear();
    state.drawnTeams.forEach(team => {
        team.players.forEach(p => state.selectedPlayerIds.add(p.id));
    });
    renderSorteioTable();
    showToast("Atletas em times selecionados!", "info");
};

export const savePlayer = async () => {
    const name = document.getElementById('playerName').value.trim();
    const id = document.getElementById('editId').value;
    
    if(!name) return showToast("Preencha o nome!", "error");
    
    const btn = document.getElementById('btnSave'); 
    btn.disabled = true; 
    btn.innerText = "SALVANDO...";
    
    try {
        const obj = { 
            name, 
            partidas: parseInt(document.getElementById('statJogos').value) || 0, 
            vitorias: parseInt(document.getElementById('statVit').value) || 0, 
            icon: document.getElementById('playerIcon').value, 
            photo: document.getElementById('photoData').value 
        };
        
        if(id) {
            await updateDoc(doc(playersRef, id), obj);
        } else {
            await addDoc(playersRef, obj);
        }
        
        showToast("Salvo!"); 
        resetForm();
    } catch(e) { 
        showToast("Erro", "error"); 
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = "<i data-lucide='save' class='w-4 h-4'></i> SALVAR"; 
        if(typeof lucide !== 'undefined') lucide.createIcons(); 
    }
};

export const deletePlayer = (id) => {
    openConfirmModal("Excluir", "Remover atleta?", async () => { 
        await deleteDoc(doc(playersRef, id)); 
        showToast("Removido."); 
    });
};

export const editPlayer = (id) => { 
    const p = state.players.find(x => x.id === id); 
    document.getElementById('playerName').value = p.name; 
    document.getElementById('editId').value = id; 
    document.getElementById('statJogos').value = p.partidas || 0;
    document.getElementById('statVit').value = p.vitorias || 0;
    document.getElementById('playerIcon').value = p.icon || 'user';

    if (p.photo) {
        document.getElementById('photoPreview').src = p.photo;
        document.getElementById('photoPreview').classList.remove('hidden');
        document.getElementById('photoPlaceholder').classList.add('hidden');
        document.getElementById('photoData').value = p.photo;
        document.getElementById('btnRemovePhoto').classList.remove('hidden');
    } else {
        removePhoto();
    }
    
    document.getElementById('formContent').classList.remove('hidden'); 
};

export const resetForm = () => { 
    ['playerName', 'editId', 'statJogos', 'statVit', 'photoData', 'playerPhoto'].forEach(id => document.getElementById(id).value = ''); 
    document.getElementById('formContent').classList.add('hidden'); 
    removePhoto(); 
};