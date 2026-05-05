import { state } from './state.js';
import { updateDoc, settingsRef } from './firebase.js';

export const getDailyPlayerStats = () => {
    const today = new Date().toLocaleDateString('pt-BR');
    const todaysMatches = (state.matchHistory || []).filter(m => 
        m.dateString === today || new Date(m.timestamp).toLocaleDateString('pt-BR') === today
    );
    
    const stats = {};
    
    todaysMatches.forEach(m => {
        const t1Won = m.winner === 1; 
        const t2Won = m.winner === 2;
        
        if (m.team1 && m.team1.players) {
            m.team1.players.forEach(name => { 
                if (!stats[name]) stats[name] = { wins: 0, losses: 0 }; 
                if (t1Won) stats[name].wins++; else stats[name].losses++; 
            });
        }
        
        if (m.team2 && m.team2.players) {
            m.team2.players.forEach(name => { 
                if (!stats[name]) stats[name] = { wins: 0, losses: 0 }; 
                if (t2Won) stats[name].wins++; else stats[name].losses++; 
            });
        }
    });
    
    let maxWins = 0, maxLosses = 0;
    Object.values(stats).forEach(s => { 
        if (s.wins > maxWins) maxWins = s.wins; 
        if (s.losses > maxLosses) maxLosses = s.losses; 
    });
    
    const craques = new Set(), bagres = new Set();
    if (maxWins >= 3) Object.keys(stats).forEach(name => { if (stats[name].wins === maxWins) craques.add(name); });
    if (maxLosses >= 3) Object.keys(stats).forEach(name => { if (stats[name].losses === maxLosses) bagres.add(name); });
    
    return { stats, craques, bagres };
};

export const getTeamName = (team) => {
    if (!team.players || team.players.length === 0) return `EQUIPE ${team.label}`;
    return `TIME DE ${team.players[0].name.split(' ')[0].toUpperCase()}`;
};

export const showToast = (msg, type = 'success') => {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').innerText = msg;
    
    let bgColor = type === 'success' ? 'bg-green-600' : (type === 'error' ? 'bg-red-600' : 'bg-blue-600');
    toast.className = `fixed bottom-5 right-5 ${bgColor} text-white px-4 py-2 rounded-xl shadow-2xl transition-transform duration-300 flex items-center gap-2 z-[60] text-sm`;
    toast.classList.remove('translate-y-24');
    
    setTimeout(() => toast.classList.add('translate-y-24'), 3500);
};

export const openConfirmModal = (title, message, callback) => {
    document.getElementById('confirmTitle').innerText = title; 
    document.getElementById('confirmMessage').innerText = message;
    state.confirmActionCallback = callback;
    document.getElementById('confirmModal').classList.remove('hidden'); 
    document.getElementById('confirmModal').classList.add('flex'); 
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

export const closeConfirmModal = () => { 
    document.getElementById('confirmModal').classList.add('hidden'); 
    document.getElementById('confirmModal').classList.remove('flex'); 
    state.confirmActionCallback = null; 
};

export const openMoveModal = (teamId, playerId) => {
    const t1 = document.getElementById('team1Select')?.value;
    const t2 = document.getElementById('team2Select')?.value;
    if (t1 && t2 && (state.score1 > 0 || state.score2 > 0)) {
        showToast("Transferência bloqueada! Um jogo está em andamento no placar.", "error");
        return;
    }

    state.moveData = { sourceTeamId: teamId, playerId: playerId };
    const player = state.drawnTeams.find(t => t.id === teamId).players.find(p => p.id === playerId);
    document.getElementById('movePlayerName').innerText = player.name;
    
    let options = '';
    const sortedTeams = [...state.drawnTeams].sort((a,b) => a.isWaitlist ? 1 : (b.isWaitlist ? -1 : parseInt(a.label) - parseInt(b.label)));
    
    sortedTeams.forEach(t => {
        if (t.id !== teamId) {
            options += `<option value="${t.id}">${t.isWaitlist ? "Lista de Espera" : getTeamName(t)}</option>`;
        }
    });
    
    document.getElementById('moveDestination').innerHTML = options;
    document.getElementById('movePlayerModal').classList.remove('hidden'); 
    document.getElementById('movePlayerModal').classList.add('flex');
};

export const closeMoveModal = () => { 
    document.getElementById('movePlayerModal').classList.add('hidden'); 
    document.getElementById('movePlayerModal').classList.remove('flex'); 
    state.moveData = { sourceTeamId: null, playerId: null }; 
};

export const closeVictoryModalOnly = async () => { 
    document.getElementById('victoryModal').classList.add('hidden'); 
    document.getElementById('victoryModal').classList.remove('flex'); 
    state.score1 = 0; 
    state.score2 = 0;
    try { await updateDoc(settingsRef, { score1: 0, score2: 0, team1: '', team2: '' }); } catch(e) {} 
    document.getElementById('score1').innerText = 0; 
    document.getElementById('score2').innerText = 0; 
    document.getElementById('team1Select').value = ''; 
    document.getElementById('team2Select').value = ''; 
};

export const switchView = (view) => {
    ['sorteio', 'login', 'admin', 'placar'].forEach(v => { 
        const e = document.getElementById(`view-${v}`); 
        if(e) e.classList.add('hidden-view'); 
    });
    
    ['btn-sorteio', 'btn-admin', 'btn-placar'].forEach(b => { 
        const e = document.getElementById(b); 
        if(e) e.classList.remove('active'); 
    });
    
    if (view === 'sorteio') { 
        document.getElementById('view-sorteio').classList.remove('hidden-view'); 
        document.getElementById('btn-sorteio').classList.add('active'); 
    } else if (view === 'placar') { 
        document.getElementById('view-placar').classList.remove('hidden-view'); 
        document.getElementById('btn-placar').classList.add('active'); 
    } else { 
        document.getElementById('btn-admin').classList.add('active'); 
        if (state.isAuthenticated) {
            document.getElementById('view-admin').classList.remove('hidden-view');
        } else {
            document.getElementById('view-login').classList.remove('hidden-view');
        }
    }
    
    renderAll();
};

export const updateSorteioCounters = () => {
    const countElement = document.getElementById('playerCountSorteio');
    if(countElement) countElement.innerText = `${state.selectedPlayerIds.size} / ${state.players.length} Selecionados`;
    
    const selectAllCheckbox = document.getElementById('selectAll');
    if(selectAllCheckbox) selectAllCheckbox.checked = state.players.length > 0 && state.selectedPlayerIds.size === state.players.length;
};

export const renderSorteioTable = () => {
    const tbody = document.getElementById('sorteioTableBody');
    if(!tbody) return;
    
    const countElement = document.getElementById('playerCountSorteio');
    if(countElement) {
        countElement.innerText = `${state.selectedPlayerIds.size} / ${state.players.length} Selecionados`;
    }
    
    const selectAllCheckbox = document.getElementById('selectAll');
    if(selectAllCheckbox) {
        selectAllCheckbox.checked = state.players.length > 0 && state.players.every(p => state.selectedPlayerIds.has(p.id));
    }
    
    const searchTerm = document.getElementById('searchSorteio')?.value.toLowerCase() || '';

    let filtered = state.players.filter(p => p.name.toLowerCase().includes(searchTerm));

    const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name));
    
    tbody.innerHTML = sorted.map(p => {
        const isSelected = state.selectedPlayerIds.has(p.id);
        
        return `
            <tr class="hover:bg-slate-700/30 transition-colors cursor-pointer" onclick="const c = document.getElementById('chk-${p.id}'); c.checked = !c.checked; togglePlayerSelection('${p.id}', c.checked); updateSorteioCounters();">
                <td class="px-2 py-3 text-center" onclick="event.stopPropagation()">
                    <input type="checkbox" id="chk-${p.id}" ${isSelected ? 'checked' : ''} onclick="togglePlayerSelection('${p.id}', this.checked); updateSorteioCounters();" class="w-4 h-4 accent-green-500 cursor-pointer">
                </td>
                <td class="px-3 py-3 font-bold text-slate-200 flex items-center gap-2 whitespace-nowrap">
                    <div class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : `<i data-lucide="${p.icon || 'user'}" class="w-3 h-3 text-slate-400"></i>`}
                    </div>
                    ${p.name}
                </td>
            </tr>`;
    }).join('');
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

export const renderAdminTable = () => {
    const tbody = document.getElementById('adminTableBody');
    if(!tbody) return;
    
    const sorted = [...state.players].sort((a, b) => a.name.localeCompare(b.name));
    
    tbody.innerHTML = sorted.map(p => {
        return `
            <tr class="hover:bg-slate-700/30 transition-colors">
                <td class="px-3 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border-2 border-slate-500">
                            ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : `<i data-lucide="${p.icon || 'user'}" class="w-4 h-4 text-slate-400"></i>`}
                        </div>
                        <span class="font-bold text-slate-200">${p.name}</span>
                    </div>
                </td>
                <td class="px-3 py-3 text-center font-bold text-yellow-500 whitespace-nowrap">
                    ${p.vitorias || 0} <span class="text-slate-500 text-xs">/ ${p.partidas || 0}</span>
                </td>
                <td class="px-3 py-3 text-right whitespace-nowrap">
                    <div class="flex justify-end gap-1">
                        <button onclick="editPlayer('${p.id}')" class="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg">
                            <i data-lucide="edit-2" class="w-3 h-3"></i>
                        </button>
                        <button onclick="deletePlayer('${p.id}')" class="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg">
                            <i data-lucide="trash-2" class="w-3 h-3"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

export const renderTeams = () => {
    const adminGrid = document.getElementById('adminTeamsGrid');
    const placarGrid = document.getElementById('placarTeamsGrid'); 
    const sections = [document.getElementById('adminTeamsSection'), document.getElementById('placarTeamsSection')]; 
    
    if (state.drawnTeams.length === 0) { 
        sections.forEach(s => { if(s) s.classList.add('hidden'); }); 
        return; 
    }
    
    sections.forEach(s => { if(s) s.classList.remove('hidden'); });
    
    const sortedTeams = state.drawnTeams.sort((a,b) => a.isWaitlist ? 1 : (b.isWaitlist ? -1 : parseInt(a.label) - parseInt(b.label)));
    
    const { stats, craques, bagres } = getDailyPlayerStats();
    
    const content = sortedTeams.map(t => {
        const teamName = t.isWaitlist ? '<i data-lucide="clock" class="inline w-4 h-4 mr-1"></i> Lista de Espera' : getTeamName(t);
        const pSorted = [...t.players].sort((a,b) => a.name.localeCompare(b.name));
        
        const controlsHTML = !t.isWaitlist ? `
            <div class="absolute top-3 right-3 flex gap-1">
                <button onclick="redrawTeamWithWaitlist('${t.id}')" class="p-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400" title="Substituir Pela Espera">
                    <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                </button>
                <button onclick="deleteTeam('${t.id}')" class="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500" title="Excluir Equipe">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>` : `
            <div class="absolute top-3 right-3 flex gap-1">
                <button onclick="promoteWaitlistToTeam('${t.id}')" class="p-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400" title="Formar Novo Time com a Espera">
                    <i data-lucide="arrow-up-circle" class="w-3 h-3"></i>
                </button>
                <button onclick="deleteTeam('${t.id}')" class="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500" title="Excluir Lista de Espera">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>`;

        const playersHTML = pSorted.map(p => {
            const dbPlayer = state.players.find(x => x.id === p.id) || p;
            const pStats = stats[dbPlayer.name] || { wins: 0, losses: 0 };
            const isCraque = craques.has(dbPlayer.name);
            const isBagre = bagres.has(dbPlayer.name);
            const waitlistBadge = (t.isWaitlist && p.waitlistRounds > 0) ? `<span class="bg-blue-500/20 text-blue-400 text-[8px] font-black px-1.5 py-0.5 rounded ml-1" title="Rodadas na Espera">${p.waitlistRounds}R</span>` : '';

            return `
                <div class="flex justify-between items-center text-xs sm:text-sm border-b border-slate-700/50 pb-1.5 last:border-0 last:pb-0 group">
                    <span class="flex items-center gap-1 sm:gap-2">
                        <div class="w-5 h-5 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                            ${dbPlayer.photo ? `<img src="${dbPlayer.photo}" class="w-full h-full object-cover">` : `<i data-lucide="${dbPlayer.icon || 'user'}" class="w-3 h-3 text-slate-400 opacity-80"></i>`}
                        </div>
                        <span class="font-bold text-slate-200 truncate max-w-[110px] sm:max-w-[130px] ml-1">${dbPlayer.name}</span>
                        <span class="text-[9px] font-bold text-slate-500 shrink-0 mx-0.5" title="Vitórias/Derrotas Diárias">(${pStats.wins}V ${pStats.losses}D)</span>
                        ${waitlistBadge}
                        ${((dbPlayer.streak || 0) >= 3) ? `<span class="flex items-center" title="${dbPlayer.streak} Vitórias Seguidas!"><i data-lucide="flame" class="w-3 h-3 text-orange-500 fill-orange-500 shrink-0"></i><span class="text-[9px] font-black text-orange-500 ml-0.5">${dbPlayer.streak}</span></span>` : ''}
                        ${((dbPlayer.streak || 0) <= -3) ? `<span class="flex items-center" title="${Math.abs(dbPlayer.streak)} Derrotas Seguidas"><i data-lucide="snowflake" class="w-3 h-3 text-blue-500 fill-blue-500 shrink-0"></i><span class="text-[9px] font-black text-blue-500 ml-0.5">${Math.abs(dbPlayer.streak)}</span></span>` : ''}
                        ${isCraque ? `<span class="flex items-center" title="Craque do Dia!"><i data-lucide="crown" class="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-yellow-400 shrink-0"></i><span class="text-[9px] font-black text-yellow-400 ml-0.5">${pStats.wins}</span></span>` : ''}
                    ${isBagre ? `<span class="flex items-center" title="Bagre do Dia"><i data-lucide="fish" class="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400 shrink-0"></i><span class="text-[9px] font-black text-emerald-400 ml-0.5">${pStats.losses}</span></span>` : ''}
                    </span>
                    <div class="flex items-center gap-1 sm:gap-2">
                        <button onclick="openMoveModal('${t.id}', '${p.id}')" class="p-1 text-slate-400 hover:text-blue-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity focus:opacity-100" title="Transferir Jogador">
                            <i data-lucide="arrow-right-left" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
                        </button>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="team-container w-full p-4 rounded-xl border relative shadow-lg ${t.isWaitlist ? 'bg-slate-800/40 border-slate-600' : 'border-slate-700 bg-slate-800/80'}">
                ${controlsHTML}
                <h3 class="font-bold ${t.isWaitlist ? 'text-slate-400' : 'text-green-500'} text-base mb-3 uppercase w-3/4">${teamName}</h3>
                <div class="space-y-2 mt-2">
                    ${playersHTML}
                </div>
            </div>`;
    }).join('');
    
    if (adminGrid) adminGrid.innerHTML = content;
    if (placarGrid) placarGrid.innerHTML = content; 
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

export const renderPlacarTeams = () => {
    const select1 = document.getElementById('team1Select');
    const select2 = document.getElementById('team2Select');
    
    if (!select1 || !select2) return;
    
    const val1 = state.currentTeam1 !== undefined ? state.currentTeam1 : select1.value;
    const val2 = state.currentTeam2 !== undefined ? state.currentTeam2 : select2.value;
    
    let optHTML = '<option value="" class="bg-slate-800 text-sm text-slate-400">SELECIONE</option>';
    
    state.drawnTeams
        .filter(t => !t.isWaitlist)
        .sort((a,b) => parseInt(a.label) - parseInt(b.label))
        .forEach(t => { 
            optHTML += `<option value="${t.label}" class="bg-slate-800 text-sm text-white">${getTeamName(t)}</option>`; 
        });
        
    select1.innerHTML = optHTML; 
    select2.innerHTML = optHTML;
    
    select1.value = val1; 
    select2.value = val2;
};

export const changeHistoryPage = (idx) => {
    state.historyCurrentPage = idx;
    renderMatchHistory();
};

export const renderMatchHistory = () => {
    const container = document.getElementById('historyList');
    const btnClear = document.getElementById('btnClearHistory');
    
    if (btnClear) {
        if (state.isAuthenticated && state.matchHistory && state.matchHistory.length > 0) {
            btnClear.classList.remove('hidden'); btnClear.classList.add('flex');
        } else {
            btnClear.classList.add('hidden'); btnClear.classList.remove('flex');
        }
    }
    if (!container) return;
    if (!state.matchHistory || state.matchHistory.length === 0) { 
        container.innerHTML = `<p class="text-slate-500 text-center text-sm py-4">Nenhuma partida registrada.</p>`; 
        return; 
    }
    
    const matches = [...state.matchHistory].sort((a,b) => b.timestamp - a.timestamp);
    const groups = [];
    let currentGroup = null;

    matches.forEach(m => {
        const dString = m.dateString || new Date(m.timestamp).toLocaleDateString('pt-BR');
        if (!currentGroup || currentGroup.date !== dString) {
            currentGroup = { date: dString, matches: [] };
            groups.push(currentGroup);
        }
        currentGroup.matches.push(m);
    });

    if (state.historyCurrentPage >= groups.length) state.historyCurrentPage = Math.max(0, groups.length - 1);
    const activeGroup = groups[state.historyCurrentPage];

    let paginationHTML = '<div class="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-2 border-b border-slate-700/50">';
    groups.forEach((g, idx) => {
        const isActive = idx === state.historyCurrentPage;
        paginationHTML += `<button onclick="changeHistoryPage(${idx})" class="px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}">${g.date}</button>`;
    });
    paginationHTML += '</div>';

    let matchesHTML = activeGroup.matches.map((m, mIdx) => {
        const t1Color = m.winner === 1 ? 'text-blue-400' : 'text-slate-400';
        const t2Color = m.winner === 2 ? 'text-red-400' : 'text-slate-400';

        return `
            <div class="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden mb-3">
                <div class="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-800 transition-colors group" onclick="document.getElementById('match-details-${mIdx}').classList.toggle('hidden')">
                    <div class="flex-1 text-right font-bold text-sm ${t1Color}">${m.team1.name}</div>
                    <div class="px-3 font-black text-lg">${m.team1.score} x ${m.team2.score}</div>
                    <div class="flex-1 text-left font-bold text-sm ${t2Color}">${m.team2.name}</div>
                </div>
                <div id="match-details-${mIdx}" class="hidden p-3 bg-slate-950/80 border-t border-slate-800/50 text-xs text-slate-300">
                    <div class="flex justify-between gap-4">
                        <div class="flex-1 text-right border-r border-slate-800 pr-4">
                            <p class="text-[10px] text-blue-400 font-bold uppercase mb-2">Time Azul</p>
                            <p class="mb-3">${(m.team1.players || []).join('<br>')}</p>
                            <p class="font-black text-sm ${m.winner === 1 ? 'text-green-400' : 'text-slate-500'}">
                                ${m.winner === 1 ? 'VENCEU' : 'PERDEU'}
                            </p>
                        </div>
                        <div class="flex-1 text-left pl-4">
                            <p class="text-[10px] text-red-400 font-bold uppercase mb-2">Time Vermelho</p>
                            <p class="mb-3">${(m.team2.players || []).join('<br>')}</p>
                            <p class="font-black text-sm ${m.winner === 2 ? 'text-green-400' : 'text-slate-500'}">
                                ${m.winner === 2 ? 'VENCEU' : 'PERDEU'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = paginationHTML + matchesHTML;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

export const openPlayerHistoryModal = (playerName) => {
    const modal = document.getElementById('playerHistoryModal');
    const list = document.getElementById('playerHistoryList');
    document.getElementById('playerHistoryTitle').innerText = `Histórico de ${playerName}`;

    const pMatches = state.matchHistory.filter(m =>
        (m.team1.players && m.team1.players.includes(playerName)) ||
        (m.team2.players && m.team2.players.includes(playerName))
    ).sort((a,b) => b.timestamp - a.timestamp);

    if(pMatches.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-500 py-4 text-sm">Nenhuma partida registrada.</p>';
    } else {
        list.innerHTML = pMatches.map((m, idx) => {
            const inT1 = m.team1.players && m.team1.players.includes(playerName);
            const myTeam = inT1 ? 1 : 2;
            const isWin = m.winner === myTeam;
            const t1Color = m.winner === 1 ? 'text-blue-400' : 'text-slate-400';
            const t2Color = m.winner === 2 ? 'text-red-400' : 'text-slate-400';
            
            const eloColor = isWin ? 'text-green-400' : 'text-red-400';

            return `
                <div class="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden mb-2">
                    <div class="p-3 cursor-pointer hover:bg-slate-800 transition-colors" onclick="document.getElementById('p-match-det-${idx}').classList.toggle('hidden')">
                        <div class="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                            <span class="text-slate-400 font-bold">${m.dateString}</span>
                            <span class="font-black ${eloColor} bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 text-[10px]">${isWin ? 'VITÓRIA' : 'DERROTA'}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="flex-1 text-right font-bold text-[11px] ${t1Color} truncate">${m.team1.name}</div>
                            <div class="px-3 font-black text-sm">${m.team1.score} x ${m.team2.score}</div>
                            <div class="flex-1 text-left font-bold text-[11px] ${t2Color} truncate">${m.team2.name}</div>
                        </div>
                    </div>
                    <div id="p-match-det-${idx}" class="hidden p-3 bg-slate-950/80 border-t border-slate-800/50 text-[10px] text-slate-300">
                        <div class="flex justify-between gap-4">
                            <div class="flex-1 text-right">
                                <p class="text-slate-500 font-bold uppercase mb-1">Time Azul</p>
                                <p>${(m.team1.players || []).join('<br>')}</p>
                            </div>
                            <div class="flex-1 text-left">
                                <p class="text-slate-500 font-bold uppercase mb-1">Time Vermelho</p>
                                <p>${(m.team2.players || []).join('<br>')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

export const closePlayerHistoryModal = () => {
    document.getElementById('playerHistoryModal').classList.add('hidden');
    document.getElementById('playerHistoryModal').classList.remove('flex');
};

export const renderAll = () => { 
    renderSorteioTable(); 
    renderAdminTable(); 
    renderTeams(); 
    renderPlacarTeams(); 
    renderMatchHistory(); 
};