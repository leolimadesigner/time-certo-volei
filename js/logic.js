import { state } from './state.js';
import { db, teamsRef, settingsRef, playersRef, matchHistoryRef, doc, deleteDoc, addDoc, updateDoc } from './firebase.js';
import { showToast, openConfirmModal, closeMoveModal, getTeamName } from './ui.js';

export const addTeamsFromSelection = async () => {
    const sizeInput = document.getElementById('teamSize');
    const size = sizeInput ? parseInt(sizeInput.value) || 4 : 4;

    const t1 = document.getElementById('team1Select')?.value;
    const t2 = document.getElementById('team2Select')?.value;
    if (t1 && t2 && (state.score1 > 0 || state.score2 > 0)) {
        showToast("Sorteio bloqueado! Um jogo está em andamento no placar.", "error");
        return;
    }

    const activePlayers = state.players.filter(p => state.selectedPlayerIds.has(p.id));
    if (activePlayers.length === 0) { showToast("Selecione os atletas na lista!", "error"); return; }

    const numberOfTeams = Math.floor(activePlayers.length / size);
    if (numberOfTeams === 0) { showToast(`Selecione pelo menos ${size} jogadores para formar um time!`, "error"); return; }

    openConfirmModal("Criar Novos Times", "Deseja formar novos times APENAS com os jogadores selecionados (mantendo os times atuais intactos)?", async () => {
        try {
            const updatePromises = [];
            const selectedIds = new Set(activePlayers.map(p => p.id));
            
            let waitlistDocId = null;
            let waitlistPlayers = [];
            
            // 1. Processar e remover os selecionados dos times que já existem
            for (const team of state.drawnTeams) {
                if (team.isWaitlist) {
                    waitlistDocId = team.id;
                    waitlistPlayers = team.players.filter(p => !selectedIds.has(p.id));
                } else {
                    const originalLength = team.players.length;
                    const filteredPlayers = team.players.filter(p => !selectedIds.has(p.id));
                    
                    if (filteredPlayers.length !== originalLength) {
                        if (filteredPlayers.length === 0) {
                            updatePromises.push(deleteDoc(doc(teamsRef, team.id)));
                        } else {
                            updatePromises.push(updateDoc(doc(teamsRef, team.id), { players: filteredPlayers }));
                        }
                    }
                }
            }

            // 2. Embaralhar e criar os novos times
            let shuffledPlayers = [...activePlayers];
            for (let i = shuffledPlayers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
            }

            const existingTeams = state.drawnTeams.filter(t => !t.isWaitlist);
            let nextLabelNumber = 1;
            if (existingTeams.length > 0) {
                const maxLabel = Math.max(...existingTeams.map(t => parseInt(t.label) || 0));
                nextLabelNumber = maxLabel + 1;
            }

            for (let i = 0; i < numberOfTeams; i++) {
                let chunk = shuffledPlayers.slice(i * size, (i + 1) * size);
                chunk.sort((a,b) => a.name.localeCompare(b.name));
                updatePromises.push(addDoc(teamsRef, { label: (nextLabelNumber + i).toString(), players: chunk }));
            }

            // 3. Processar resto para a lista de espera
            const remainders = shuffledPlayers.slice(numberOfTeams * size).map(p => ({...p, waitlistRounds: 0}));
            waitlistPlayers = [...waitlistPlayers, ...remainders].sort((a,b) => a.name.localeCompare(b.name));

            // 4. Atualizar a lista de espera
            if (waitlistDocId) {
                if (waitlistPlayers.length > 0) {
                    updatePromises.push(updateDoc(doc(teamsRef, waitlistDocId), { players: waitlistPlayers }));
                } else {
                    const originalWaitlist = state.drawnTeams.find(t => t.id === waitlistDocId);
                    if (originalWaitlist && originalWaitlist.players.length > 0) {
                        updatePromises.push(deleteDoc(doc(teamsRef, waitlistDocId)));
                    }
                }
            } else if (waitlistPlayers.length > 0) {
                updatePromises.push(addDoc(teamsRef, { label: 'DE FORA', isWaitlist: true, players: waitlistPlayers }));
            }

            await Promise.all(updatePromises);
            showToast("Novo(s) time(s) criado(s) com sucesso!", "success");
        } catch(e) { 
            console.error(e);
            showToast("Erro ao criar times", "error"); 
        }
    });
};

export const drawTeams = async () => {
    const sizeInput = document.getElementById('teamSize');
    const size = sizeInput ? parseInt(sizeInput.value) || 4 : 4;

    const t1 = document.getElementById('team1Select')?.value;
    const t2 = document.getElementById('team2Select')?.value;
    if (t1 && t2 && (state.score1 > 0 || state.score2 > 0)) {
        showToast("Sorteio bloqueado! Um jogo está em andamento. Zere o placar antes de um novo sorteio.", "error");
        return;
    }

    const activePlayers = state.players.filter(p => state.selectedPlayerIds.has(p.id));
    if (activePlayers.length === 0) { showToast("Selecione os atletas para o jogo!", "error"); return; }

    const numberOfTeams = Math.floor(activePlayers.length / size);
    if (numberOfTeams === 0) { showToast(`Selecione pelo menos ${size} jogadores para o sorteio!`, "error"); return; }

    openConfirmModal("Sorteio Geral Aleatório", "Todas as equipes atuais serão desfeitas e sorteadas de forma puramente aleatória.", async () => {
        try {
            // Limpar equipas antigas
            const deletePromises = state.drawnTeams.map(t => deleteDoc(doc(teamsRef, t.id)));
            await Promise.all(deletePromises);
            
            // Embaralhamento puramente aleatório usando Fisher-Yates
            let shuffledPlayers = [...activePlayers];
            for (let i = shuffledPlayers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
            }

            // Formar Equipas
            const teams = [];
            for(let i = 0; i < numberOfTeams; i++) {
                let chunk = shuffledPlayers.slice(i * size, (i + 1) * size);
                // Apenas ordenar por ordem alfabética para ficar bonito na UI
                chunk.sort((a,b) => a.name.localeCompare(b.name));
                teams.push(chunk);
            }

            // O resto vai para a lista de espera
            const waitlist = shuffledPlayers.slice(numberOfTeams * size).map(p => ({...p, waitlistRounds: 0}));
            waitlist.sort((a,b) => a.name.localeCompare(b.name));

            // Gravar Equipas na Base de Dados
            for (let i = 0; i < teams.length; i++) {
                await addDoc(teamsRef, { label: (i + 1).toString(), players: teams[i] });
            }
            
            if (waitlist.length > 0) {
                await addDoc(teamsRef, { label: 'DE FORA', isWaitlist: true, players: waitlist });
                showToast(`Sorteio concluído! ${waitlist.length} atleta(s) na espera.`);
            } else { 
                showToast("Equipes aleatórias formadas!"); 
            }
        } catch(e) { showToast("Erro ao realizar Sorteio Geral", "error"); }
    });
};

export const redrawTeamWithWaitlist = async (teamId) => {
    const t1 = document.getElementById('team1Select')?.value;
    const t2 = document.getElementById('team2Select')?.value;
    if (t1 && t2 && (state.score1 > 0 || state.score2 > 0)) {
        showToast("Troca bloqueada! Um jogo está em andamento no placar.", "error");
        return;
    }
    
    openConfirmModal("Sorteio de Substituições", "Deseja substituir jogadores desta equipa pela lista de espera de forma aleatória?", async () => {
        const targetTeamDoc = state.drawnTeams.find(t => t.id === teamId);
        if (!targetTeamDoc) return;

        const waitlistTeamDoc = state.drawnTeams.find(t => t.isWaitlist);
        
        const currentTeamPlayers = targetTeamDoc.players.map(p => ({...p, isFromTeam: true}));
        const waitlistPlayers = waitlistTeamDoc ? waitlistTeamDoc.players.map(p => ({...p, isFromWaitlist: true})) : [];
        
        const allAssignedIds = new Set([
            ...state.drawnTeams.filter(t => !t.isWaitlist).flatMap(t => t.players.map(p => p.id)),
            ...waitlistPlayers.map(p => p.id)
        ]);
        
        const activeSelected = state.players.filter(p => state.selectedPlayerIds.has(p.id));
        const newUnassigned = activeSelected.filter(p => !allAssignedIds.has(p.id)).map(p => ({...p, isNew: true, waitlistRounds: 0})); 
        
        let pool = [...currentTeamPlayers, ...waitlistPlayers, ...newUnassigned];
        
        const sizeInput = document.getElementById('teamSize');
        const N = sizeInput ? parseInt(sizeInput.value) || 4 : 4;

        if (pool.length < N) {
            showToast("Não há jogadores suficientes para formar um time completo.", "warning");
            return;
        }

        let mandatory = pool.filter(p => p.isFromWaitlist && p.waitlistRounds >= 1);
        
        if(mandatory.length > N) {
            for (let i = mandatory.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [mandatory[i], mandatory[j]] = [mandatory[j], mandatory[i]];
            }
            mandatory = mandatory.slice(0, N);
        }

        const remainingPool = pool.filter(p => !mandatory.some(m => m.id === p.id));
        const slotsLeft = N - mandatory.length;

        let randomPicks = [];
        if(slotsLeft > 0) {
            for (let i = remainingPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remainingPool[i], remainingPool[j]] = [remainingPool[j], remainingPool[i]];
            }
            randomPicks = remainingPool.slice(0, slotsLeft);
        }

        let finalTeam = [...mandatory, ...randomPicks];

        const newTeamIds = new Set(finalTeam.map(p => p.id));
        
        const newTeam = finalTeam.map(p => {
            const { isFromTeam, isFromWaitlist, isNew, ...rest } = p;
            return { ...rest, waitlistRounds: 0 }; 
        }).sort((a, b) => a.name.localeCompare(b.name));

        const newWaitlist = pool.filter(p => !newTeamIds.has(p.id)).map(p => {
            const { isFromTeam, isFromWaitlist, isNew, ...rest } = p;
            let rounds = 0;
            if (isFromWaitlist) {
                rounds = (p.waitlistRounds || 0) + 1; 
            } else if (isFromTeam || isNew) {
                rounds = 0; 
            }
            return { ...rest, waitlistRounds: rounds };
        }).sort((a, b) => {
            if (b.waitlistRounds !== a.waitlistRounds) return (b.waitlistRounds || 0) - (a.waitlistRounds || 0);
            return a.name.localeCompare(b.name);
        });

        try {
            await updateDoc(doc(teamsRef, targetTeamDoc.id), { players: newTeam });
            
            if (waitlistTeamDoc) {
                if (newWaitlist.length > 0) {
                    await updateDoc(doc(teamsRef, waitlistTeamDoc.id), { players: newWaitlist });
                } else {
                    await deleteDoc(doc(teamsRef, waitlistTeamDoc.id));
                }
            } else if (newWaitlist.length > 0) {
                await addDoc(teamsRef, { label: 'DE FORA', isWaitlist: true, players: newWaitlist });
            }
            showToast("Sorteio de substituição feito!", "success");
        } catch(e) { console.error(e); showToast("Erro ao substituir equipe", "error"); }
    });
};

export const createWaitlist = () => {
    openConfirmModal("Sincronizar Presenças", "Isso irá remover os atletas desmarcados dos times e adicionar os novos marcados na lista de espera. Deseja continuar?", async () => {
        try {
            const waitlistTeamDoc = state.drawnTeams.find(t => t.isWaitlist);
            let currentWaitlistPlayers = [];
            const updatePromises = [];
            
            for (const team of state.drawnTeams) {
                if (!team.isWaitlist) {
                    const filteredPlayers = team.players.filter(p => state.selectedPlayerIds.has(p.id));
                    if (filteredPlayers.length !== team.players.length) {
                        if (filteredPlayers.length === 0) {
                            updatePromises.push(deleteDoc(doc(teamsRef, team.id)));
                        } else {
                            updatePromises.push(updateDoc(doc(teamsRef, team.id), { players: filteredPlayers }));
                        }
                    }
                } else {
                    currentWaitlistPlayers = team.players.filter(p => state.selectedPlayerIds.has(p.id));
                }
            }
            
            const playersInNormalTeamsIds = new Set(
                state.drawnTeams
                    .filter(t => !t.isWaitlist)
                    .flatMap(t => t.players.filter(p => state.selectedPlayerIds.has(p.id)).map(p => p.id))
            );
            const playersInWaitlistIds = new Set(currentWaitlistPlayers.map(p => p.id));
            
            const activePlayers = state.players.filter(p => state.selectedPlayerIds.has(p.id));
            const newPlayersToAdd = activePlayers.filter(p => !playersInNormalTeamsIds.has(p.id) && !playersInWaitlistIds.has(p.id));
            
            const newPlayersWithRounds = newPlayersToAdd.map(p => ({ ...p, waitlistRounds: 0 }));
            
            const updatedWaitlist = [...currentWaitlistPlayers, ...newPlayersWithRounds].sort((a, b) => a.name.localeCompare(b.name));
            
            if (waitlistTeamDoc) {
                if (updatedWaitlist.length > 0) {
                    updatePromises.push(updateDoc(doc(teamsRef, waitlistTeamDoc.id), { players: updatedWaitlist }));
                } else {
                    updatePromises.push(deleteDoc(doc(teamsRef, waitlistTeamDoc.id)));
                }
            } else if (updatedWaitlist.length > 0) {
                updatePromises.push(addDoc(teamsRef, { label: 'DE FORA', isWaitlist: true, players: updatedWaitlist }));
            }
            
            await Promise.all(updatePromises);
            showToast("Sincronização de presença concluída!", "success");
        } catch (e) { 
            console.error(e);
            showToast("Erro ao atualizar presenças", "error"); 
        }
    });
};

export const confirmMovePlayer = async () => {
    const destTeamId = document.getElementById('moveDestination').value;
    const { sourceTeamId, playerId } = state.moveData;

    if (!destTeamId || !sourceTeamId || !playerId) {
        showToast("Erro ao transferir jogador.", "error");
        return;
    }

    const sourceTeam = state.drawnTeams.find(t => t.id === sourceTeamId);
    const destTeam = state.drawnTeams.find(t => t.id === destTeamId);

    if (!sourceTeam || !destTeam) return;

    const playerIndex = sourceTeam.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const playerToMove = sourceTeam.players.splice(playerIndex, 1)[0];

    if (destTeam.isWaitlist) {
        playerToMove.waitlistRounds = 0;
    } else if (sourceTeam.isWaitlist) {
        playerToMove.waitlistRounds = 0;
    }

    destTeam.players.push(playerToMove);

    const sortFn = (a, b) => {
        if (destTeam.isWaitlist || sourceTeam.isWaitlist) {
            if (b.waitlistRounds !== a.waitlistRounds) return (b.waitlistRounds || 0) - (a.waitlistRounds || 0);
        }
        return a.name.localeCompare(b.name);
    };

    sourceTeam.players.sort(sortFn);
    destTeam.players.sort(sortFn);

    try {
        closeMoveModal();
        const updates = [];

        if (sourceTeam.players.length === 0) {
            updates.push(deleteDoc(doc(teamsRef, sourceTeamId)));
        } else {
            updates.push(updateDoc(doc(teamsRef, sourceTeamId), { players: sourceTeam.players }));
        }

        updates.push(updateDoc(doc(teamsRef, destTeamId), { players: destTeam.players }));

        await Promise.all(updates);
        showToast("Transferência concluída!", "success");
    } catch (e) {
        console.error(e);
        showToast("Erro ao transferir jogador.", "error");
    }
};

export const clearTeams = () => {
    openConfirmModal("Limpar Todas as Equipes", "Deseja realmente excluir todas as equipes geradas?", async () => {
        try {
            const deletePromises = state.drawnTeams.map(t => deleteDoc(doc(teamsRef, t.id)));
            await Promise.all(deletePromises);
            showToast("Todas as equipes foram removidas!", "info");
        } catch (e) { showToast("Erro ao limpar equipes", "error"); }
    });
};

export const deleteTeam = (id) => {
    const t1 = document.getElementById('team1Select')?.value;
    const t2 = document.getElementById('team2Select')?.value;
    if (t1 && t2 && (state.score1 > 0 || state.score2 > 0)) {
        showToast("Exclusão bloqueada! Um jogo está em andamento no placar.", "error");
        return;
    }

    const teamToDelete = state.drawnTeams.find(t => t.id === id);
    if (!teamToDelete) return;

    const modalMsg = teamToDelete.isWaitlist 
        ? "Deseja remover a lista de espera do sorteio?" 
        : "Deseja desmanchar esta equipe? Os jogadores serão enviados para a lista de espera.";

    openConfirmModal("Remover Equipe", modalMsg, async () => {
        try { 
            if (teamToDelete.isWaitlist) {
                await deleteDoc(doc(teamsRef, id)); 
                showToast("Lista de espera removida.", "info"); 
            } else {
                const waitlistTeam = state.drawnTeams.find(t => t.isWaitlist);
                const playersToMove = teamToDelete.players.map(p => ({ ...p, waitlistRounds: 0 }));
                const updates = [];

                updates.push(deleteDoc(doc(teamsRef, id)));

                if (waitlistTeam) {
                    const updatedWaitlistPlayers = [...waitlistTeam.players, ...playersToMove].sort((a, b) => a.name.localeCompare(b.name));
                    updates.push(updateDoc(doc(teamsRef, waitlistTeam.id), { players: updatedWaitlistPlayers }));
                } else {
                    const sortedPlayers = playersToMove.sort((a, b) => a.name.localeCompare(b.name));
                    updates.push(addDoc(teamsRef, { label: 'DE FORA', isWaitlist: true, players: sortedPlayers }));
                }

                await Promise.all(updates);
                showToast("Equipe desfeita! Jogadores na espera.", "info");
            }
        } catch (e) { 
            console.error(e);
            showToast("Erro ao excluir equipe", "error"); 
        }
    });
};

export const checkWinCondition = () => {
    const isTradicionalWin = (state.score1 >= 21 || state.score2 >= 21) && Math.abs(state.score1 - state.score2) >= 2;
    const isCapoteWin = (state.score1 >= 8 && state.score2 === 0) || (state.score2 >= 8 && state.score1 === 0);
    
    if (isTradicionalWin || isCapoteWin) {
        const select1 = document.getElementById('team1Select'), select2 = document.getElementById('team2Select');
        let winnerName = state.score1 > state.score2 ? (select1.value && select1.selectedIndex > 0 ? select1.options[select1.selectedIndex].text : "TIME 1 (AZUL)") : (select2.value && select2.selectedIndex > 0 ? select2.options[select2.selectedIndex].text : "TIME 2 (VERMELHO)");
        document.getElementById('victoryTeamName').innerText = winnerName;
        
        const btnSaveResult = document.getElementById('btnSaveResult');
        const warning = document.getElementById('victoryTeamWarning');

        if (!select1.value || !select2.value || select1.value === select2.value) { 
            btnSaveResult.classList.add('hidden'); 
            warning.classList.remove('hidden'); 
            warning.innerText = "Selecione duas equipes válidas e diferentes.";
        } else if (!state.isAuthenticated && !state.eloEnabled) {
            btnSaveResult.classList.add('hidden'); 
            warning.classList.remove('hidden'); 
            warning.innerText = "A gravação do placar está fechada. Apenas o administrador pode salvar os resultados.";
        } else { 
            btnSaveResult.classList.remove('hidden'); 
            warning.classList.add('hidden'); 
        }
        
        document.getElementById('victoryModal').classList.remove('hidden'); 
        document.getElementById('victoryModal').classList.add('flex');
        if (isCapoteWin) showToast("🔥 VITÓRIA POR CAPOTE (8 a 0)! 🔥", "success");
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
};

export const syncTeamsToCloud = async () => {
    const t1 = document.getElementById('team1Select')?.value || '';
    const t2 = document.getElementById('team2Select')?.value || '';
    try {
        await updateDoc(settingsRef, { team1: t1, team2: t2 });
    } catch (e) {
        console.error("Erro ao sincronizar times:", e);
    }
};

export const updateScore = async (team, change) => {
    if (team === 1) { state.score1 = Math.max(0, state.score1 + change); document.getElementById('score1').innerText = state.score1; }
    else { state.score2 = Math.max(0, state.score2 + change); document.getElementById('score2').innerText = state.score2; }
    
    try { await updateDoc(settingsRef, { score1: state.score1, score2: state.score2 }); } catch(e) {}
    checkWinCondition();
};

export const resetScore = () => {
    openConfirmModal("Zerar Placar", "Deseja realmente zerar o placar da partida atual?", async () => {
        state.score1 = 0; state.score2 = 0; 
        try { await updateDoc(settingsRef, { score1: 0, score2: 0, team1: '', team2: '' }); } catch(e) {}
        
        document.getElementById('score1').innerText = state.score1; 
        document.getElementById('score2').innerText = state.score2;
        document.getElementById('team1Select').value = ''; 
        document.getElementById('team2Select').value = ''; 
        showToast("Placar zerado!", "info");
    });
};

export const saveAndCloseVictoryModal = async () => {
    if (state.score1 === 0 && state.score2 === 0) {
        showToast("Esta partida já foi encerrada por outro usuário.", "warning");
        return;
    }

    const select1 = document.getElementById('team1Select');
    const select2 = document.getElementById('team2Select');
    if (!select1 || !select2 || !select1.value || !select2.value || select1.value === select2.value) {
        showToast("Selecione dois times válidos e diferentes no placar!", "error");
        return;
    }

    const team1 = state.drawnTeams.find(t => t.label === select1.value);
    const team2 = state.drawnTeams.find(t => t.label === select2.value);
    if (!team1 || !team2) return;

    const isTeam1Winner = state.score1 > state.score2;
    const actualT1 = isTeam1Winner ? 1 : 0;
    const actualT2 = isTeam1Winner ? 0 : 1;

    const btnSave = document.getElementById('btnSaveResult');
    btnSave.innerText = "SALVANDO...";
    btnSave.disabled = true;

    try {
        const updatePromises = [];
        const processedPlayerIds = new Set(); 

        [ {team: team1, actual: actualT1}, {team: team2, actual: actualT2} ].forEach(({team, actual}) => {
            team.players.forEach(p => {
                if (processedPlayerIds.has(p.id)) return; 
                processedPlayerIds.add(p.id);

                const dbPlayer = state.players.find(x => x.id === p.id);
                if (dbPlayer) {
                    const partidas = (dbPlayer.partidas || 0) + 1;
                    const vitorias = (dbPlayer.vitorias || 0) + actual;
                    
                    const currentStreak = dbPlayer.streak || 0;
                    const newStreak = actual === 1 ? (currentStreak >= 0 ? currentStreak + 1 : 1) : (currentStreak <= 0 ? currentStreak - 1 : -1);
                    
                    updatePromises.push(updateDoc(doc(playersRef, p.id), {
                        partidas, vitorias, streak: newStreak, updatedAt: Date.now()
                    }));
                }
            });
        });

        const matchRecord = {
            timestamp: Date.now(),
            dateString: new Date().toLocaleDateString('pt-BR'),
            team1: { name: getTeamName(team1), score: state.score1, players: team1.players.map(p => p.name) },
            team2: { name: getTeamName(team2), score: state.score2, players: team2.players.map(p => p.name) },
            winner: isTeam1Winner ? 1 : 2
        };
        updatePromises.push(addDoc(matchHistoryRef, matchRecord));

        await Promise.all(updatePromises);
        
        showToast(`Histórico e vitórias gravados!`, "success");

        document.getElementById('victoryModal').classList.add('hidden');
        document.getElementById('victoryModal').classList.remove('flex');
        
        state.score1 = 0; state.score2 = 0;
        try { await updateDoc(settingsRef, { score1: 0, score2: 0, team1: '', team2: '' }); } catch(e) {} 
        document.getElementById('score1').innerText = state.score1; 
        document.getElementById('score2').innerText = state.score2;
        document.getElementById('team1Select').value = ''; 
        document.getElementById('team2Select').value = ''; 
        
    } catch (error) {
        console.error(error);
        showToast("Erro ao salvar resultado.", "error");
    } finally {
        btnSave.innerText = "SALVAR HISTÓRICO";
        btnSave.disabled = false;
    }
};

export const promoteWaitlistToTeam = async (waitlistTeamId) => {
    const t1 = document.getElementById('team1Select')?.value;
    const t2 = document.getElementById('team2Select')?.value;
    if (t1 && t2 && (state.score1 > 0 || state.score2 > 0)) {
        showToast("Ação bloqueada! Um jogo está em andamento no placar.", "error");
        return;
    }

    openConfirmModal("Promover Lista de Espera", "Deseja criar um novo time aleatório usando os jogadores da lista de espera?", async () => {
        const waitlistDoc = state.drawnTeams.find(t => t.id === waitlistTeamId && t.isWaitlist);
        if (!waitlistDoc) return;

        const sizeInput = document.getElementById('teamSize');
        const N = sizeInput ? parseInt(sizeInput.value) || 4 : 4;

        if (waitlistDoc.players.length < N) {
            showToast(`A lista precisa ter pelo menos ${N} jogadores.`, "warning");
            return;
        }

        let pool = [...waitlistDoc.players];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        let newTeamPlayers = pool.slice(0, N).map(p => ({...p, waitlistRounds: 0}));
        newTeamPlayers.sort((a,b) => a.name.localeCompare(b.name));

        const remainingWaitlist = pool.slice(N);
        remainingWaitlist.sort((a,b) => a.name.localeCompare(b.name));

        try {
            const existingTeams = state.drawnTeams.filter(t => !t.isWaitlist);
            let nextLabelNumber = 1;
            if (existingTeams.length > 0) {
                const maxLabel = Math.max(...existingTeams.map(t => parseInt(t.label) || 0));
                nextLabelNumber = maxLabel + 1;
            }

            await addDoc(teamsRef, { label: nextLabelNumber.toString(), players: newTeamPlayers });

            if (remainingWaitlist.length > 0) {
                await updateDoc(doc(teamsRef, waitlistDoc.id), { players: remainingWaitlist });
            } else {
                await deleteDoc(doc(teamsRef, waitlistDoc.id));
            }
            showToast("Nova equipe formada aleatoriamente!", "success");
        } catch (e) {
            console.error(e);
            showToast("Erro ao promover lista de espera.", "error");
        }
    });
};

export const clearMatchHistory = () => {
    openConfirmModal("Limpar Histórico", "Deseja realmente apagar todo o histórico de partidas?", async () => {
        try {
            const deletePromises = state.matchHistory.map(m => deleteDoc(doc(matchHistoryRef, m.id)));
            await Promise.all(deletePromises);
            showToast("Histórico de partidas limpo!", "info");
        } catch (e) { 
            console.error(e); 
            showToast("Erro ao limpar histórico", "error"); 
        }
    });
};