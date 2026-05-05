export const state = {
    players: [], 
    drawnTeams: [], 
    matchHistory: [],
    selectedPlayerIds: new Set(), 
    isFirstLoad: true,
    isAuthenticated: false, 
    eloEnabled: false, 
    score1: 0, 
    score2: 0,
    historyCurrentPage: 0, 
    confirmActionCallback: null, 
    moveData: { 
        sourceTeamId: null, 
        playerId: null 
    },
    currentTeam1: undefined,
    currentTeam2: undefined
};