import { state } from './state.js';
import { 
    switchView, closeConfirmModal, openMoveModal, closeMoveModal, 
    closeVictoryModalOnly, updateSorteioCounters, renderSorteioTable, 
    changeHistoryPage, openPlayerHistoryModal, closePlayerHistoryModal 
} from './ui.js';

import { 
    addTeamsFromSelection, drawTeams, redrawTeamWithWaitlist, createWaitlist, 
    confirmMovePlayer, clearTeams, deleteTeam, syncTeamsToCloud, 
    updateScore, resetScore, saveAndCloseVictoryModal, promoteWaitlistToTeam, 
    clearMatchHistory 
} from './logic.js';

import { 
    handleImageUpload, removePhoto, toggleEloSystem, handleLogin, handleLogout, 
    togglePlayerSelection, toggleAllPlayers, selectOnlyPlayersInTeams, 
    savePlayer, deletePlayer, editPlayer, resetForm 
} from './admin.js';

// Anexa as funções necessárias ao window (acessível no index.html)
Object.assign(window, {
    switchView, toggleEloSystem, handleLogin, handleLogout, drawTeams,
    addTeamsFromSelection, clearTeams, deleteTeam, createWaitlist,
    redrawTeamWithWaitlist, updateScore, resetScore, saveAndCloseVictoryModal,
    closeVictoryModalOnly, toggleAllPlayers, togglePlayerSelection,
    renderSorteioTable, savePlayer, deletePlayer, editPlayer, resetForm,
    closeConfirmModal, openMoveModal, closeMoveModal, handleImageUpload,
    removePhoto, confirmMovePlayer, clearMatchHistory, changeHistoryPage,
    openPlayerHistoryModal, closePlayerHistoryModal, selectOnlyPlayersInTeams,
    syncTeamsToCloud, updateSorteioCounters, promoteWaitlistToTeam
});

document.addEventListener('DOMContentLoaded', () => {
    const btnConfirm = document.getElementById('btnConfirmAction');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => { 
            if (state.confirmActionCallback) state.confirmActionCallback(); 
            closeConfirmModal(); 
        });
    }
    
    switchView('sorteio');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});