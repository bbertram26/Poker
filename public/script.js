class PokerClient {
    constructor() {
        this.socket = io();
        this.playerId = null;
        this.roomId = null;
        this.roomName = null;
        this.isHost = false;
        this.gameState = null;
        this.players = [];
        this.cheatMode = false;
        this.cardsHidden = false;
        this.alertLater = false;
        this.roomSettings = {
            allowMidGameJoining: true
        };
        
        this.setupSocketEvents();
        this.setupUIEvents();
        this.setupCheatConsole();
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            this.showScreen('mainMenu');
        });

        this.socket.on('panicRedirect', (data) => {
            // Dynamically construct the redirect URL using the current host
            let redirectUrl = data.redirectUrl;
            if (redirectUrl === 'SAME_HOST:3001') {
                // Use the same protocol and host that the user is currently connected to
                const currentHost = window.location.hostname;
                const currentProtocol = window.location.protocol;
                redirectUrl = `${currentProtocol}//${currentHost}:3002`; // Updated to new port
            }
            
            // Show Christian intervention message
            const emergencyDiv = document.createElement('div');
            emergencyDiv.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #2c3e50, #34495e);
                color: white;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-family: Georgia, serif;
                text-align: center;
                animation: fadeIn 0.8s ease-in;
            `;
            
            emergencyDiv.innerHTML = `
                <div style="max-width: 700px; padding: 50px;">
                    <div style="font-size: 4rem; margin-bottom: 30px;">✝️</div>
                    <h1 style="font-size: 2.5rem; margin-bottom: 25px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); font-weight: normal;">
                        Christian Gambling Recovery Ministry
                    </h1>
                    <p style="font-size: 1.3rem; margin-bottom: 35px; line-height: 1.6; font-style: italic;">
                        "For where your treasure is, there your heart will be also." - Matthew 6:21
                    </p>
                    <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; margin-bottom: 40px; border: 2px solid rgba(255,255,255,0.2);">
                        <p style="font-size: 1.4rem; margin: 0 0 20px 0; font-weight: bold;">
                            🙏 You are being redirected to our faith-based recovery resources
                        </p>
                        <p style="font-size: 1.1rem; margin: 0; opacity: 0.9;">
                            Find freedom from gambling through Christ's love and our supportive Christian community.
                        </p>
                    </div>
                    <div style="font-size: 1.1rem; opacity: 0.8;">
                        <div style="margin-bottom: 10px;">📖 Bible studies • 🤝 Support groups • 💒 Local church connections</div>
                        <div style="font-size: 0.95rem; margin-top: 20px;">
                            Redirecting to recovery ministry in <span id="countdown">5</span> seconds...
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                </style>
            `;
            
            document.body.appendChild(emergencyDiv);
            
            // Countdown and redirect
            let countdown = 5;
            const countdownEl = document.getElementById('countdown');
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdownEl) countdownEl.textContent = countdown;
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    window.location.href = redirectUrl;
                }
            }, 1000);
        });

        this.socket.on('roomCreated', (data) => {
            this.roomId = data.roomCode;
            this.roomName = data.roomName;
            this.isHost = true;
            this.players = data.players;
            this.playerId = data.players.find(p => p.isHost).id;
            this.showLobby();
            this.showToast(`🎉 Room ${data.roomCode} created!`, 'success');
        });

        this.socket.on('roomJoined', (data) => {
            this.roomId = data.roomCode;
            this.roomName = data.roomName;
            this.isHost = false;
            this.players = data.players;
            this.showLobby();
            this.showToast('✅ Joined room!', 'success');
        });

        this.socket.on('playerUpdate', (data) => {
            this.players = data.players;
            
            const me = this.players.find(p => p.id === this.playerId);
            if (me && me.isHost && !this.isHost) {
                this.isHost = true;
                this.showToast('👑 You are now the host!', 'success');
                this.updateHostControls();
            }
            
            this.updateLobbyDisplay();
        });

        this.socket.on('gameStarted', (data) => {            
            this.gameState = data.gameState;
            this.players = data.players;
            
            // Auto-show cards when new hand starts
            if (this.cardsHidden) {
                this.toggleHideCards();
            }
            
            this.showScreen('gameScreen');
            this.updateGameDisplay();
            
            // Update debt tracker if provided
            if (data.overallDebt) {
                this.updateDebtTracker(data.overallDebt, data.directDebts);
            }
            
            // Close any open modals
            this.closeModal();
            
            this.showToast('🎮 Game started!', 'success');
        });

        this.socket.on('gameUpdate', (data) => {
            this.gameState = data.gameState;
            this.players = data.players;
            this.updateGameDisplay();
        });

        this.socket.on('playerJoined', (data) => {
            this.players = data.players;
            const message = data.joinedMidGame ? 
                `👤 ${data.newPlayerName} joined and is waiting for next hand` : 
                `👤 ${data.newPlayerName} joined the game`;
            this.showToast(message, 'info');
            this.updateLobbyDisplay();
            this.updateGameDisplay();
        });

        this.socket.on('playerLeft', (data) => {
            this.players = data.players;
            this.gameState = data.gameState;
            
            // Force update the display immediately
            this.updateGameDisplay();
            this.updateBettingControls();
            
            this.showToast(`👋 ${data.playerName} left the game`, 'info');
        });

        this.socket.on('notEnoughPlayers', (data) => {
            this.showToast('👋 The room was closed due to lack of players.', 'error');
            this.returnToMainMenu();
        });

        this.socket.on('actionResult', (data) => {
            let message = '';
            switch (data.action) {
                case 'fold': message = `${data.player} folds`; break;
                case 'check': message = `${data.player} checks`; break;
                case 'call': message = `${data.player} calls $${data.amount}`; break;
                case 'raise': message = `${data.player} raises to $${data.amount}`; break;
            }
        });

        this.socket.on('handComplete', (data) => {
            // Update debt tracker with new debts
            if (data.overallDebt) {
                this.updateDebtTracker(data.overallDebt, data.directDebts);
            }
            
            this.showWinnerModal(data);

            // Hide betting controls when hand is complete
            const controls = document.getElementById('bettingControls');
            if (controls) controls.style.display = 'none';
            
            // Auto-deal next hand after 7 seconds
            setTimeout(() => {
                this.socket.emit('autoDealNext');
            }, 7000);
        });

        this.socket.on('error', (message) => {
            this.showToast(`❌ ${message}`, 'error');
        });

        // Debt management events
        this.socket.on('debtUpdate', (data) => {
            if (data.overallDebt) {
                this.updateDebtTracker(data.overallDebt, data.directDebts);
            }
            if (data.message) {
                this.showToast(`💰 ${data.message}`, 'info');
            }
        });

        this.socket.on('debtTransferResult', (data) => {
            if (data.success) {
                this.showToast(`✅ ${data.message}`, 'success');
            } else {
                this.showToast(`❌ ${data.message}`, 'error');
            }
        });

        this.socket.on('debtSettlementResult', (data) => {
            if (data.success) {
                this.showToast(`✅ ${data.message}`, 'success');
            } else {
                this.showToast(`❌ ${data.message}`, 'error');
            }
        });
    }

    setupUIEvents() {
        document.getElementById('createRoomBtn').addEventListener('click', () => this.showScreen('createRoomScreen'));
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.showScreen('joinRoomScreen'));
        document.getElementById('backToMainBtn').addEventListener('click', () => this.showScreen('mainMenu'));
        document.getElementById('backToMainBtn2').addEventListener('click', () => this.showScreen('mainMenu'));
        
        document.getElementById('createRoomConfirm').addEventListener('click', () => this.createRoom());
        document.getElementById('joinRoomConfirm').addEventListener('click', () => this.joinRoom());
        document.getElementById('leaveLobbyBtn').addEventListener('click', () => this.leaveRoom());
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        
        document.getElementById('foldBtn').addEventListener('click', () => this.takeAction('fold'));
        document.getElementById('checkBtn').addEventListener('click', () => this.takeAction('check'));
        document.getElementById('callBtn').addEventListener('click', () => this.takeAction('call'));
        document.getElementById('raiseBtn').addEventListener('click', () => this.raiseAction());
        
        document.getElementById('newGameBtn').addEventListener('click', () => this.dealNewHand());
        document.getElementById('backToLobbyBtn').addEventListener('click', () => this.showScreen('lobbyScreen'));
        
        document.getElementById('setPlayerCardsBtn').addEventListener('click', () => this.setPlayerCards());
        document.getElementById('hideCardsBtn').addEventListener('click', () => this.toggleHideCards());
        document.getElementById('copyRoomCodeBtn').addEventListener('click', () => this.copyRoomCode());
        
        document.getElementById('roomCode').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    setupCheatConsole() {
        window.game = {
            panel: {
                adminOpen: () => {
                    this.cheatModeEnabled = true;
                    
                    if (this.roomId && this.playerId) {
                        this.socket.emit('cheatModeActivated', {
                            roomCode: this.roomId,
                            playerName: this.playerId
                        });
                    } else {
                        this.alertLater = true
                    }

                    // Add keydown listener for L key
                    document.addEventListener('keydown', (e) => {
                        if (e.code === 'Backslash' && e.shiftKey && this.cheatModeEnabled && !e.repeat) {
                            e.preventDefault();
                            this.toggleCheatPanel();
                        }
                    });
                }
            }
        };
    }

    toggleCheatPanel() {
        const panel = document.getElementById('cheatPanel');
        const isVisible = panel.style.display === 'block';
        
        if (isVisible) {
            panel.style.display = 'none';
            this.cheatMode = false;
            if (this.gameState) this.updateGameDisplay();
        } else {
            panel.style.display = 'block';
            this.cheatMode = true;
            this.populateCheatDropdowns();
            this.updateCheatDisplay();
            if (this.gameState) this.updateGameDisplay();

            if (this.alertLater && this.roomId && this.playerId) {
                this.socket.emit('cheatModeActivated', {
                    roomCode: this.roomId,
                    playerName: this.playerId
                });
                this.alertLater = false;
            }
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    createRoom() {
        const hostName = document.getElementById('hostName').value.trim();
        const roomName = document.getElementById('roomName').value.trim();
        
        if (!hostName || !roomName) {
            this.showToast('❌ Fill in all fields', 'error');
            return;
        }

        this.playerId = hostName;
        this.socket.emit('createRoom', { hostName, roomName });
    }

    joinRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        const roomCode = document.getElementById('roomCode').value.trim();
        
        if (!playerName || !roomCode) {
            this.showToast('❌ Fill in all fields', 'error');
            return;
        }

        this.playerId = playerName;
        this.socket.emit('joinRoom', { playerName, roomCode });
    }

    showLobby() {
        this.showScreen('lobbyScreen');
        document.getElementById('lobbyRoomName').textContent = this.roomName;
        document.getElementById('lobbyRoomCode').textContent = this.roomId;
        
        const copyBtn = document.getElementById('copyRoomCodeBtn');
        if (copyBtn) {
            copyBtn.style.display = 'inline-block'; // or 'block' depending on your CSS
        }
        
        this.updateHostControls();
        this.updateLobbyDisplay();
    }

    updateHostControls() {
        const startBtn = document.getElementById('startGameBtn');
        const settingsBtn = document.getElementById('gameSettingsBtn');
        
        if (this.isHost) {
            if (startBtn) startBtn.style.display = 'block';
            if (settingsBtn) settingsBtn.style.display = 'block';
        } else {
            if (startBtn) startBtn.style.display = 'none';
            if (settingsBtn) settingsBtn.style.display = 'none';
        }
    }

    updateLobbyDisplay() {
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');
        
        playersList.innerHTML = '';
        playerCount.textContent = this.players.length;
        
        this.players.forEach(player => {
            const div = document.createElement('div');
            div.className = `player-item ${player.isHost ? 'host' : ''} ${player.inWaitingRoom ? 'waiting' : ''}`;
            div.innerHTML = `
                <div class="player-info">
                    <span class="player-name">
                        ${player.name} 
                        ${player.isHost ? '<i class="fas fa-crown" style="color: var(--gold);"></i>' : ''}
                    </span>
                </div>
                <div class="player-status">${player.inWaitingRoom ? 'Waiting for next game' : 'Ready'}</div>
            `;
            playersList.appendChild(div);
        });
    }

    startGame() {
        if (this.players.length < 2) {
            this.showToast('❌ Need at least 2 players', 'error');
            return;
        }
        
        this.socket.emit('startGame');
    }

    updateGameDisplay() {
        if (!this.gameState) return;

        document.getElementById('potAmount').textContent = this.gameState.pot || 0;
        document.getElementById('gamePhase').textContent = this.gameState.phase.toUpperCase();
        document.getElementById('gameRoomName').textContent = this.roomName;
        document.getElementById('gameRoomCode').textContent = this.roomId;
        
        // SETTINGS was removed, keeping this for future reference
        const settingsFloatingBtn = document.getElementById('gameSettingsFloatingBtn');
        if (settingsFloatingBtn) {
            settingsFloatingBtn.style.display = this.isHost ? 'flex' : 'none';
        }
        
        const gameCopyBtn = document.getElementById('gameScreenCopyBtn'); // if this exists
        if (gameCopyBtn) {
            gameCopyBtn.style.display = 'inline-block';
        }

        this.updateCommunityCards();
        this.updatePlayerHand();
        this.updatePlayersTable();
        this.updateBettingControls();
    }

    updateCommunityCards() {
        const cardSlots = ['flop1', 'flop2', 'flop3', 'turn', 'river'];
        cardSlots.forEach((slotId, index) => {
            const slot = document.getElementById(slotId);
            if (this.gameState.communityCards && this.gameState.communityCards[index]) {
                // Only animate if the card is new (slot was empty)
                const wasEmpty = slot.innerHTML === '';
                slot.innerHTML = this.renderCard(this.gameState.communityCards[index], wasEmpty);
            } else {
                slot.innerHTML = '';
            }
        });
    }

    updatePlayerHand() {
        const myPlayer = this.players.find(p => p.id === this.playerId);
        if (myPlayer && myPlayer.cards && myPlayer.cards.length >= 2) {
            const card1Slot = document.getElementById('playerCard1');
            const card2Slot = document.getElementById('playerCard2');
            
            if (!this.cardsHidden) {
                // Only animate on initial deal (when cards are empty)
                const wasEmpty1 = card1Slot.innerHTML === '';
                const wasEmpty2 = card2Slot.innerHTML === '';
                
                card1Slot.innerHTML = this.renderCard(myPlayer.cards[0], wasEmpty1);
                card2Slot.innerHTML = this.renderCard(myPlayer.cards[1], wasEmpty2);
            }
            
            // If cards are hidden, don't update the display
            document.getElementById('playerMoney').textContent = myPlayer.totalPaidThisHand || 0;
        }
    }

    updatePlayersTable() {
        const table = document.getElementById('playersTable');
        table.innerHTML = '';
        
        // Filter out waiting room players
        const activePlayers = this.players.filter(player => !player.inWaitingRoom);
        table.setAttribute('data-player-count', activePlayers.length);
        
        // Keep consistent seating order - don't rotate based on dealer
        activePlayers.forEach((player) => {
            const originalIndex = this.players.findIndex(p => p.id === player.id);
            this.createPlayerElement(player, originalIndex, table);
        });
    }
    
    createPlayerElement(player, originalIndex, table) {
        const div = document.createElement('div');
        const isActive = this.gameState && originalIndex === this.gameState.activePlayerIndex;
        const isFolded = player.hasFolded;
        const isDealer = this.gameState && originalIndex === this.gameState.dealerIndex;
        
        div.className = `table-player ${isActive ? 'active' : ''} ${isFolded ? 'folded' : ''}`;
        div.innerHTML = `
            <div class="player-name">
                ${player.name}
                ${player.isHost ? '<i class="fas fa-crown" style="color: var(--gold);"></i>' : ''}
                ${isDealer ? '<i class="fas fa-star" style="color: var(--warning-color);" title="Dealer"></i>' : ''}
            </div>
            <div class="player-money">
                <i class="fas fa-coins"></i>
                Paid: $${player.totalPaidThisHand || 0}
            </div>
            ${player.betThisRound > 0 ? `<div class="player-bet">This Round: $${player.betThisRound}</div>` : ''}
                    <div class="player-cards">
                        ${player.cards && Array.isArray(player.cards) && player.cards.length === 2 ? 
                            player.cards.map(card => {
                                if (!card || !card.rank || !card.suit) {
                                    return '<div class="mini-card back"></div>';
                                }
                                
                                // Check if we should show this player's cards
                                if (!this.shouldShowCards(player) || isFolded) {
                                    return '<div class="mini-card back folded"></div>';
                                }
                                
                                const color = this.getCardColor(card);
                                
                                return `<div class="mini-card ${color}">
                                    <div class="mini-rank">${card.rank}</div>
                                    <div class="mini-suit">${card.suit}</div>
                                </div>`;
                            }).join('') : 
                            '<div class="mini-card back"></div><div class="mini-card back"></div>'
                        }
                    </div>
            ${isFolded ? '<div class="folded-overlay">FOLDED</div>' : ''}
        `;
        table.appendChild(div);
    }

    updateBettingControls() {
        const controls = document.getElementById('bettingControls');
        const myPlayer = this.players.find(p => p.id === this.playerId);
        const waitingOnDisplay = document.getElementById('waitingOnDisplay');
        const waitingOnPlayer = document.getElementById('waitingOnPlayer');
                
        if (!this.gameState || !myPlayer || !controls) {
            if (controls) controls.style.display = 'none';
            return;
        }

        const activePlayer = this.gameState.activePlayerIndex < this.players.length ? this.players[this.gameState.activePlayerIndex] : null;        
        const isMyTurn = activePlayer && activePlayer.id === this.playerId && !myPlayer.hasFolded;

        // Update waiting on display
        if (waitingOnDisplay && waitingOnPlayer) {
            if (!isMyTurn && activePlayer && !activePlayer.hasFolded) {
                waitingOnDisplay.style.display = 'block';
                waitingOnPlayer.textContent = activePlayer.name;
            } else {
                waitingOnDisplay.style.display = 'none';
            }
        }
                
        // Get all button elements with null checks
        const checkBtn = document.getElementById('checkBtn');
        const callBtn = document.getElementById('callBtn');
        const foldBtn = document.getElementById('foldBtn');
        const raiseBtn = document.getElementById('raiseBtn');
        const raiseSection = document.querySelector('.raise-section');
        const currentBetEl = document.getElementById('currentBet');
        const callAmountEl = document.getElementById('callAmount');
        
        if (!checkBtn || !callBtn || !foldBtn || !raiseBtn || !raiseSection) {
            return;
        }
        
        // Hide everything first
        checkBtn.style.display = 'none';
        callBtn.style.display = 'none';
        foldBtn.style.display = 'none';
        raiseBtn.style.display = 'none';
        raiseSection.style.display = 'none';
        
        if (isMyTurn && !myPlayer.hasFolded) {
            controls.style.display = 'block';
            
            if (this.gameState.phase === 'preflop') {
                // PRE-FLOP: ONLY Call $1 and Fold
                callBtn.style.display = 'inline-flex';
                foldBtn.style.display = 'inline-flex';
                
                callBtn.innerHTML = `<i class="fas fa-phone"></i> Call $1`;
                if (currentBetEl) currentBetEl.textContent = '1';
                if (callAmountEl) callAmountEl.textContent = '1';
            } else {
                // POST-FLOP: Check current betting situation
                const currentBet = this.gameState.currentBet || 0;
                const myBet = myPlayer.betThisRound || 0;
                const callAmount = currentBet - myBet;
                                
                if (currentBetEl) currentBetEl.textContent = currentBet;

                const remainingCap = Math.max(0, 100 - Number(myPlayer.totalPaidThisHand || 0));
                const maxAllowed = Math.max(0, remainingCap - callAmount);
                
                if (currentBet === 0) {
                    // No bet yet - show Check and Raise
                    checkBtn.style.display = 'inline-flex';
                    raiseBtn.style.display = 'inline-flex';
                    raiseSection.style.display = 'flex';
                    
                    const raiseAmountInput = document.getElementById('raiseAmount');
                    if (raiseAmountInput) {
                        raiseAmountInput.max = maxAllowed;
                        if (maxAllowed === 0) {
                            raiseBtn.style.display = 'none';
                            raiseSection.style.display = 'none';
                        } else {
                            raiseAmountInput.placeholder = `$1-$${maxAllowed}`;
                        }
                    }
                } else if (callAmount > 0) {
                    // Someone bet - show Call, Raise, and Fold
                    callBtn.style.display = 'inline-flex';
                    callBtn.innerHTML = `<i class="fas fa-phone"></i> Call $${callAmount}`;
                    if (callAmountEl) callAmountEl.textContent = callAmount;
                    
                    raiseBtn.style.display = 'inline-flex';
                    raiseSection.style.display = 'flex';
                    
                    const raiseAmountInput2 = document.getElementById('raiseAmount');
                    if (raiseAmountInput2) {
                        raiseAmountInput2.max = maxAllowed;
                        if (maxAllowed === 0) {
                            raiseBtn.style.display = 'none';
                            raiseSection.style.display = 'none';
                        } else {
                            raiseAmountInput2.placeholder = `$1-$${maxAllowed}`;
                        }
                    }
                    
                    foldBtn.style.display = 'inline-flex';
                } else {
                    // Already matched bet - show only Check
                    checkBtn.style.display = 'inline-flex';
                }
            }
        } else {
            controls.style.display = 'none';
        }
    }

    takeAction(action) {
        this.socket.emit('playerAction', { action });
    }

    raiseAction() {
        const myPlayer = this.players.find(p => p.id === this.playerId);
        const myBet = myPlayer.betThisRound || 0;
        const currentBet = this.gameState.currentBet || 0;
        const callAmount = currentBet - myBet;
        const remainingCap = Math.max(0, 100 - Number(myPlayer.totalPaidThisHand || 0));
        const maxAllowed = Math.max(0, remainingCap - callAmount);
        const amount = parseInt(document.getElementById('raiseAmount').value);
        

        if (!amount || amount < 1 || amount > maxAllowed) {
            if (maxAllowed == 0) {
                this.showToast('❌ You cannot raise anymore', 'error');
            } else {
                this.showToast(`❌ Raise $1-$${maxAllowed}`, 'error');
                return;
            }
        }

        this.socket.emit('playerAction', { action: 'raise', amount });
        document.getElementById('raiseAmount').value = '';
    }

    renderCard(card, includeAnimation = false, playerHasFolded = false) {
        if (!card) {
            return '<div class="card back"></div>';
        }
        
        const isRed = card.suit === '♥' || card.suit === '♦';
        return `<div class="card ${isRed ? 'red' : 'black'} ${includeAnimation ? 'dealt' : ''}">
            <div class="card-rank">${card.rank}</div>
            <div class="card-suit">${card.suit}</div>
        </div>`;
    }

    getCardColor(card) {
        if (!card || !card.suit) return 'black';
        return (card.suit === '♥' || card.suit === '♦') ? 'red' : 'black';
    }

    shouldShowCards(player) {
        if (player.id === this.playerId) {
            return !this.cardsHidden; // Hide own cards if cards are hidden
        }
        return this.cheatMode; // Show other players' cards only in cheat mode
    }

    updateDebtTracker(debtData, directDebts = []) {
        const debtContent = document.getElementById('debtTrackerContent');
        if (!debtContent) return;
        
        // Use direct debts if available, otherwise fall back to old format
        if (directDebts && directDebts.length > 0) {
            this.updateDebtTrackerWithDirectDebts(directDebts);
            return;
        }
        
        if (!debtData || debtData.length === 0) {
            debtContent.innerHTML = '<div class="no-debt">You have no debt.</div>';
            return;
        }

        debtContent.innerHTML = '';
        
        // Find my debt and show my relationships with other players
        const myDebt = debtData.find(debt => debt.name === this.playerId);
        const myAmount = myDebt ? myDebt.amount : 0;
        
        // Show only my debts with other players, ignore their debts with each other
        const myDebts = [];
        
        debtData.forEach(debt => {
            if (debt.name !== this.playerId) {
                // Only show if there's an actual debt relationship
                if (myAmount > 0 && debt.amount < 0) {
                    // I won money, they lost money - they owe me
                    const amount = Math.min(Math.abs(myAmount), Math.abs(debt.amount));
                    myDebts.push({
                        name: debt.name,
                        amount: -amount // Negative means they owe me
                    });
                } else if (myAmount < 0 && debt.amount > 0) {
                    // I lost money, they won money - I owe them
                    const amount = Math.min(Math.abs(myAmount), Math.abs(debt.amount));
                    myDebts.push({
                        name: debt.name,
                        amount: amount // Positive means I owe them
                    });
                }
            }
        });
        
        if (myDebts.length === 0) {
            debtContent.innerHTML = '<div class="no-debt">You have no debt to track.</div>';
            return;
        }
        
        // Sort by amount (people who owe me first - negative amounts)
        myDebts.sort((a, b) => a.amount - b.amount);
        
        this.renderDebtItems(myDebts);
    }

    updateDebtTrackerWithDirectDebts(directDebts) {
        const debtContent = document.getElementById('debtTrackerContent');
        if (!debtContent) return;
        
        // Filter debts that involve this player
        const myDebts = [];
        
        directDebts.forEach(debt => {
            if (debt.debtor === this.playerId) {
                // I owe someone money
                myDebts.push({
                    name: debt.creditor,
                    amount: debt.amount // Positive means I owe them
                });
            } else if (debt.creditor === this.playerId) {
                // Someone owes me money
                myDebts.push({
                    name: debt.debtor,
                    amount: -debt.amount // Negative means they owe me
                });
            }
        });
        
        if (myDebts.length === 0) {
            debtContent.innerHTML = '<div class="no-debt">You have no debt to track.</div>';
            return;
        }
        
        // Sort: people who owe me first (negative amounts), then people I owe
        myDebts.sort((a, b) => a.amount - b.amount);
        
        debtContent.innerHTML = '';
        this.renderDebtItems(myDebts);
    }

    renderDebtItems(myDebts) {
        const debtContent = document.getElementById('debtTrackerContent');
        
        myDebts.forEach(debt => {
            const debtDiv = document.createElement('div');
            const iOwe = debt.amount > 0;
            
            debtDiv.className = `debt-item ${iOwe ? 'you-owe' : 'owes-you'}`;
            
            const actionButtons = iOwe ? 
                `<div class="debt-actions">
                    <span class="debt-note">💰 Pay ${debt.name} in person</span>
                </div>` : 
                `<div class="debt-actions">
                    <button class="btn-mini btn-success" onclick="pokerClient.markAsPaid('${debt.name}', '${this.playerId}', ${Math.abs(debt.amount)})">
                        ✓ Mark as Received $${Math.abs(debt.amount)}
                    </button>
                </div>`;
            
            debtDiv.innerHTML = `
                <div class="debt-main">
                    <span class="debt-player-name">${debt.name}</span>
                    <span class="debt-amount ${iOwe ? 'negative' : 'positive'}">
                        ${iOwe ? `I owe $${debt.amount}` : `Owes me $${Math.abs(debt.amount)}`}
                    </span>
                </div>
                ${actionButtons}
            `;
            debtContent.appendChild(debtDiv);
        });
    }

    showWinnerModal(result) {
        const myPlayer = this.players.find(p => p.id === this.playerId);
        const myContribution = myPlayer.totalPaidThisHand || 0;
        const isWinner = result.isPush ? 
            result.winners && result.winners.includes(this.playerId) :
            result.winner === this.playerId;
        
        const contributionsHtml = result.contributions.length > 0 ? 
            result.contributions.map(c => `
                <div class="contribution-item">
                    <span class="contributor-name">${c.name}</span>
                    <span class="contribution-amount">owes ${result.isPush ? 'winners' : 'winner'} $${c.amount}</span>
                </div>
            `).join('') : '';

        // Create all hands display
        const allHandsHtml = result.allHands ? result.allHands.map(hand => {
            // Check if this was a fold-win (everyone else folded)
            const activePlayers = result.allHands.filter(h => !h.folded);
            const wasFoldWin = activePlayers.length === 1;
            
            return `
                <div class="hand-reveal ${result.isPush ? (result.winners && result.winners.includes(hand.name) ? 'winner-hand' : '') : (hand.name === result.winner ? 'winner-hand' : '')} ${hand.folded ? 'folded-hand' : ''}">
                    <div class="player-name-reveal">${hand.name}</div>
                    <div class="hand-cards-reveal">
                        ${hand.folded || wasFoldWin ? 
                            `<div class="card back"></div><div class="card back"></div>` :
                            `${this.renderCard(hand.cards[0])}${this.renderCard(hand.cards[1])}`
                        }
                    </div>
                    <div class="hand-type">${hand.folded ? 'Folded' : (wasFoldWin ? 'Last Player Standing' : hand.handType)}</div>
                </div>
            `;
        }).join('') : '';

        // Calculate net winnings for display
        const netWinAmount = result.isPush ? 
            Math.floor(result.potAmount / result.winners.length) - myContribution :
            isWinner ? result.potAmount - myContribution : result.potAmount;

        const modal = this.createModal(result.isPush ? '🤝 Push!' : '🎉 Hand Complete', `
            <div class="winner-section">
                <div class="winner-announcement">
                    <i class="fas fa-${result.isPush ? 'handshake' : 'trophy'}"></i>
                    <h3>${result.isPush ? `Push! ${result.winner}` : `${result.winner} Wins!`}</h3>
                    ${result.winningHand ? `<div class="winning-hand-type">${result.winningHand.name}</div>` : ''}
                    <div class="win-amount">
                        ${result.isPush ? 
                            `Split $${result.potAmount} (${Math.floor(result.potAmount / result.winners.length)} each)` : 
                            isWinner ? 
                                `Net win: $${netWinAmount}` : 
                                `Total pot: $${result.potAmount}`
                        }
                    </div>
                </div>
                
                <div class="all-hands-section">
                    <h4>🃏 All Players' Hands:</h4>
                    <div class="hands-grid">
                        ${allHandsHtml}
                    </div>
                </div>
                
                <div class="modal-actions">
                    <div class="action-row">
                        <button id="closeResult" class="btn btn-primary btn-large">
                            <i class="fas fa-check"></i>
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        `);

        document.getElementById('closeResult').addEventListener('click', () => {
            this.closeModal();
        });
    }

    createModal(title, content) {
        const existingModal = document.querySelector('.custom-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.custom-modal').remove()">×</button>
                </div>
                <div class="modal-body">${content}</div>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    closeModal() {
        const modal = document.querySelector('.custom-modal');
        if (modal) modal.remove();
    }

    dealNewHand() {
        this.socket.emit('newHand');
    }

    leaveRoom() {
        this.returnToMainMenu();
    }

    returnToMainMenu() {
        this.playerId = null;
        this.roomId = null;
        this.roomName = null;
        this.isHost = false;
        this.gameState = null;
        this.players = [];
        this.showScreen('mainMenu');
    }

    // Cheat functions
    openCheatPanel() {
        document.getElementById('cheatPanel').style.display = 'block';
        this.cheatMode = true;
        this.populateCheatDropdowns();
        this.updateCheatDisplay();

        if (this.roomId && this.playerId) {
            this.socket.emit('cheatModeActivated', {
                roomCode: this.roomId,
                playerName: this.playerId
            });
        }
    }

    closeCheatPanel() {
        document.getElementById('cheatPanel').style.display = 'none';
        this.cheatMode = false;
        if (this.gameState) this.updateGameDisplay();
    }

    populateCheatDropdowns() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        const options = ['<option value="">Select Card</option>'];
        suits.forEach(suit => {
            ranks.forEach(rank => {
                options.push(`<option value="${rank}-${suit}">${rank}${suit}</option>`);
            });
        });
        
        document.getElementById('setCard1').innerHTML = options.join('');
        document.getElementById('setCard2').innerHTML = options.join('');
    }

    updateCheatDisplay() {
        const display = document.getElementById('allPlayersCards');
        if (!display) return;
        
        display.innerHTML = '';
        this.players.forEach(player => {
            if (player.cards && player.cards.length >= 2) {
                const div = document.createElement('div');
                div.className = 'cheat-player-cards';
                div.innerHTML = `
                    <span>${player.name}:</span>
                    <span>${player.cards[0].rank}${player.cards[0].suit} ${player.cards[1].rank}${player.cards[1].suit}</span>
                `;
                display.appendChild(div);
            }
        });
    
        // Capture once per hand (preflop only), then always show the same snapshot
        if (this.cheatMode && this.gameState) {
            this.ensureFutureBoardSnapshot();
            const f1 = document.getElementById('futureFlop1');
            const f2 = document.getElementById('futureFlop2');
            const f3 = document.getElementById('futureFlop3');
            const t = document.getElementById('futureTurn');
            const r = document.getElementById('futureRiver');
            if (!(f1 && f2 && f3 && t && r)) return;
    
            if (this.currentHandFutureCards) {
                const future = this.currentHandFutureCards;
                f1.textContent = `${future.flop1.rank}${future.flop1.suit}`;
                f2.textContent = `${future.flop2.rank}${future.flop2.suit}`;
                f3.textContent = `${future.flop3.rank}${future.flop3.suit}`;
                t.textContent = `${future.turn.rank}${future.turn.suit}`;
                r.textContent = `${future.river.rank}${future.river.suit}`;
            } else {
                f1.textContent = '--';
                f2.textContent = '--';
                f3.textContent = '--';
                t.textContent = '--';
                r.textContent = '--';
            }
        }
    }

    ensureFutureBoardSnapshot() {
        if (this.gameState && this.gameState.round !== this.lastHandRound) {
            this.currentHandFutureCards = null;
            this.lastHandRound = this.gameState.round;
        }
    
        if (!this.gameState) return;
        if (this.currentHandFutureCards) return; // already captured for this hand
    
        const deck = this.gameState.deck || [];
        const cc = this.gameState.communityCards || [];
        const L = deck.length;
    
        // Server uses deck.pop() with NO burns
    
        // If river is out, snapshot exactly the board
        if (cc.length === 5) {
            this.currentHandFutureCards = {
                flop1: cc[0], flop2: cc[1], flop3: cc[2],
                turn: cc[3], river: cc[4]
            };
            return;
        }
    
        // Turn is out: river is next on top of deck
        if (cc.length === 4) {
            if (L < 1) return;
            this.currentHandFutureCards = {
                flop1: cc[0], flop2: cc[1], flop3: cc[2],
                turn: cc[3], river: deck[L - 1]
            };
            return;
        }
    
        // Flop is out: turn, river are next on top of deck
        if (cc.length === 3) {
            if (L < 2) return;
            this.currentHandFutureCards = {
                flop1: cc[0], flop2: cc[1], flop3: cc[2],
                turn: deck[L - 1], river: deck[L - 2]
            };
            return;
        }
    
        // Preflop: predict all five from top of deck
        if (cc.length === 0 && L >= 5) {
            this.currentHandFutureCards = {
                flop1: deck[L - 1], flop2: deck[L - 2], flop3: deck[L - 3],
                turn: deck[L - 4], river: deck[L - 5]
            };
        }

        this.currentHandFutureCards = {
            flop1: deck[L - 1],
            flop2: deck[L - 2],
            flop3: deck[L - 3],
            turn:  deck[L - 4],
            river: deck[L - 5]
        };
    }

    setPlayerCards() {
        const card1 = document.getElementById('setCard1').value;
        const card2 = document.getElementById('setCard2').value;
        
        if (card1 && card2) {
            const cards = [this.parseCard(card1), this.parseCard(card2)];
            this.socket.emit('cheatSetCards', { cards });
        }
    }

    parseCard(value) {
        const [rank, suit] = value.split('-');
        return { rank, suit };
    }

    toggleHideCards() {
        this.cardsHidden = !this.cardsHidden;
        const hideBtn = document.getElementById('hideCardsBtn');
        const card1 = document.getElementById('playerCard1');
        const card2 = document.getElementById('playerCard2');
        
        if (this.cardsHidden) {
            // Hide cards
            hideBtn.innerHTML = '<i class="fas fa-eye"></i>';
            hideBtn.classList.add('btn-warning');
            hideBtn.title = 'Show Cards';
            
            card1.innerHTML = '<div class="card-back"><i class="fas fa-question"></i></div>';
            card2.innerHTML = '<div class="card-back"><i class="fas fa-question"></i></div>';
        } else {
            // Show cards
            hideBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            hideBtn.classList.remove('btn-warning');
            hideBtn.title = 'Hide Cards';
            
            // Refresh the player hand display
            this.updatePlayerHand();
        }
        
        // Update the table display to hide/show mini cards too
        this.updatePlayersTable();
    }

    copyRoomCode() {
        let roomCode = this.roomId;
        
        if (!roomCode) {
            const roomCodeElements = [
                document.getElementById('lobbyRoomCode'),
                document.getElementById('gameRoomCode'),
                document.querySelector('.room-code'),
                document.querySelector('[data-room-code]')
            ];
            
            for (const element of roomCodeElements) {
                if (element && element.textContent.trim()) {
                    roomCode = element.textContent.trim();
                    break;
                }
            }
        }
        
        if (!roomCode) {
            this.showToast('❌ Room code not available', 'error');
            return;
        }
        
        // Use the modern Clipboard API if available
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(roomCode).then(() => {
                this.showToast('✅ Room code copied to clipboard', 'success');
            }).catch(err => {
                console.error('Failed to copy room code:', err);
                this.showToast('❌ Failed to copy room code', 'error');
                this.fallbackCopyTextToClipboard(roomCode);
            });
        } else {
            // Fallback for older browsers or non-HTTPS contexts
            this.fallbackCopyTextToClipboard(roomCode);
        }
    }
    
    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showToast('✅ Room code copied to clipboard', 'success');
            } else {
                this.showToast('❌ Failed to copy room code', 'error');
                console.error('Copy command has failed.');
            }
        } catch (err) {
            this.showToast('❌ Failed to copy room code', 'error');
            console.error('Copy failed:', err);
        }
        
        document.body.removeChild(textArea);
    }

    showGameSettings() {
        const currentSetting = this.roomSettings.allowMidGameJoining;
        
        const modal = this.createModal('⚙️ Room Settings', `
            <div class="settings-content">
                <div class="setting-item">
                    <div class="setting-info">
                        <h4>Mid-Game Joining</h4>
                        <p>Allow new players to join while a game is in progress. They will wait until the next hand.</p>
                    </div>
                    <div class="setting-control">
                        <label class="toggle-switch">
                            <input type="checkbox" id="midGameJoinToggle" ${currentSetting ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button id="saveSettings" class="btn btn-primary">
                    <i class="fas fa-save"></i>
                    Save Settings
                </button>
                <button id="cancelSettings" class="btn btn-secondary">
                    <i class="fas fa-times"></i>
                    Cancel
                </button>
            </div>
        `);

        document.getElementById('saveSettings').addEventListener('click', () => {
            const newSetting = document.getElementById('midGameJoinToggle').checked;
            this.roomSettings.allowMidGameJoining = newSetting;
            const status = newSetting ? 'enabled' : 'disabled';
            this.showToast(`⚙️ Mid-game joining ${status}`, 'success');
            this.closeModal();
        });

        document.getElementById('cancelSettings').addEventListener('click', () => {
            this.closeModal();
        });
    }

    settleDebt(debtorId, creditorId, amount) {
        if (!this.roomId || !this.socket) {
            this.showToast('❌ Not connected to a room', 'error');
            return;
        }
        
        this.socket.emit('settleDebt', {
            debtorId: debtorId,
            creditorId: creditorId,
            amount: amount
        });
    }

    markAsPaid(debtorId, creditorId, amount) {
        // This is the same as settling debt - marking as received
        this.settleDebt(debtorId, creditorId, amount);
    }

    transferDebt(fromPlayerId, toPlayerId, creditorId, amount) {
        if (!this.roomId || !this.socket) {
            this.showToast('❌ Not connected to a room', 'error');
            return;
        }
        
        this.socket.emit('transferDebt', {
            fromPlayerId: fromPlayerId,
            toPlayerId: toPlayerId,
            creditorId: creditorId,
            amount: amount
        });
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

(function attachWifiOverlayHotkey() {
    const steps = [
        'Connecting to Russell County Schools WiFi',
        'Initializing deep packet inspection',
        'Applying kernel-level hooks ',
        'Verifying stack integrity',
        'Synchronizing PCIe bus lanes',
        'Running microcode update',
        'Performing firmware integrity check',
        'Testing I/O buffer latency',
        'Calculating ECC memory correction',
        'Applying BIOS overrides',
        'Executing low-level API calls',
        'Validating TLB entries',
        'Monitoring DMA channels',
        'Updating interrupt vectors',
        'Checking PCI device IDs',
        'Running SMBus scan',
        'Synchronizing CPU cores',
        'Evaluating instruction pipeline',
        'Flushing branch predictor',
        'Testing cache coherency',
        'Initializing GPU memory map',
        'Verifying VRAM timing',
        'Running cryptographic RNG',
        'Generating ephemeral session keys',
        'Applying entropy pool updates',
        'Performing bit-level handshake',
        'Analyzing TCP window scaling',
        'Testing SYN flood resilience',
        'Performing ICMP timestamp check',
        'Validating ARP table consistency',
        'Applying VLAN trunking protocol',
        'Monitoring spanning tree convergence',
        'Evaluating STP root bridge',
        'Checking MAC address table',
        'Synchronizing SNTP clients',
        'Applying network buffer tuning',
        'Running IPv4 fragmentation test',
        'Checking jumbo frame compatibility',
        'Verifying path MTU discovery',
        'Applying BGP route dampening',
        'Testing OSPF neighbor adjacency',
        'Monitoring MPLS labels',
        'Validating GRE tunnels',
        'Checking IPsec SA lifetimes',
        'Synchronizing DTLS session',
        'Performing multi-factor auth handshake',
        'Verifying PKI hierarchy',
        'Running certificate pinning validation',
        'Checking OCSP stapling',
        'Validating CRL download',
        'Performing heuristic anomaly scan',
        'Initializing adaptive congestion control',
        'Applying deep learning packet prioritization',
        'Running quantum-safe cryptographic check',
        'Synchronizing entropy across cores',
        'Testing hyperthreading pipeline integrity',
        'Updating SIMD register cache',
        'Flushing micro-op cache',
        'Verifying speculative execution safety',
        'Checking branch misprediction rates',
        'Running inter-core latency diagnostics',
        'Applying hardware prefetch optimization',
        'Monitoring instruction retirement',
        'Updating PCIe latency table',
        'Initializing firmware sandbox',
        'Validating ECC parity bits',
        'Running asynchronous I/O stress test',
        'Testing socket buffer saturation',
        'Checking TCP retransmission queue',
        'Performing selective ACK evaluation',
        'Applying window scaling algorithms',
        'Verifying jitter buffer stability',
        'Monitoring MTU fragmentation',
        'Performing ARP spoofing resilience check',
        'Testing DHCP lease renewal sequence',
        'Checking RARP fallback mechanisms',
        'Evaluating DNSSEC validation path',
        'Updating TLS handshake cache',
        'Testing HSTS policy enforcement',
        'Performing HTTP/3 QUIC protocol validation',
        'Applying OCSP response caching',
        'Verifying CA certificate chain integrity',
        'Running certificate transparency log check',
        'Initializing VPN tunnel encapsulation',
        'Monitoring IPsec SA negotiation',
        'Testing ESP packet sequence',
        'Performing NAT traversal check',
        'Checking GRE tunnel CRC',
        'Applying MACsec encryption keys',
        'Validating VLAN tagging consistency',
        'Monitoring STP topology changes',
        'Running RSTP convergence test',
        'Evaluating MSTP instance alignment',
        'Applying LACP link aggregation',
        'Verifying PPPoE session integrity',
        'Testing SCTP multi-homing',
        'Applying QoS DSCP markings',
        'Monitoring bandwidth shaping',
        'Checking traffic policer enforcement',
        'Running policing and queuing diagnostics',
        'Applying CoS prioritization',
        'Verifying IGMP snooping tables',
        'Monitoring PIM sparse mode',
        'Evaluating BGP path selection',
        'Testing route flap damping',
        'Applying OSPF LSA throttling',
        'Validating IS-IS adjacency',
        'Running MPLS LSP path validation',
        'Checking RSVP-TE signaling',
        'Testing fast reroute protocols',
        'Applying SD-WAN policy rules',
        'Monitoring vEdge connectivity',
        'Validating cloud edge routing',
        'Initializing telemetry streaming',
        'Collecting NetFlow records',
        'Applying sFlow sampling',
        'Monitoring packet loss patterns',
        'Running latency heatmap analysis',
        'Testing jitter variation',
        'Evaluating bandwidth utilization',
        'Applying firewall state inspection',
        'Checking IDS signature updates',
        'Running heuristic anomaly detection',
        'Performing sandboxed packet execution',
        'Monitoring endpoint compliance',
        'Updating NAC policies',
        'Applying DLP content rules',
        'Checking application whitelists',
        'Running URL categorization',
        'Monitoring parental control logs',
        'Evaluating safe browsing enforcement',
        'Testing captive portal redirects',
        'Applying session token validation',
        'Monitoring device posture',
        'Updating threat intelligence feeds',
        'Verifying TLS interception',
        'Running decryption engine tests',
        'Checking cipher negotiation',
        'Performing key exchange validation',
        'Applying ephemeral key rotation',
        'Testing forward secrecy',
        'Monitoring encrypted traffic patterns',
        'Validating handshake renegotiation',
        'Performing cryptographic padding checks',
        'Initializing ephemeral session handshake',
        'Verifying zero-trust policy compliance',
        'Applying continuous access evaluation',
        'Monitoring micro-segmentation',
        'Running behavior-based detection',
        'Applying AI-driven anomaly alerts',
        'Finalizing network orchestration',
        'Connection was dropped, retrying connection to the network.'
    ];
    let idx = 0;
    let timer = null;
    let dotCount = 0;
    let ticks = 0;

    function setStepText() {
        const el = document.getElementById('wifiStepText');
        if (!el) return;
        dotCount = (dotCount % 3) + 1;
        const dots = '.'.repeat(dotCount);
        el.textContent = `${steps[idx]}${dots}`;
    }

    function startRotation() {
        stopRotation();
        idx = 0;
        dotCount = 0;
        ticks = 0;
        setStepText();
        timer = setInterval(() => {
            setStepText();
            ticks++;
            if (ticks % 8 === 0) {
                idx = (idx + 1) % steps.length;
            }
        }, 500);
    }

    function stopRotation() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function toggleWifiOverlay() {
        const overlay = document.getElementById('wifiOverlay');
        if (!overlay) return;
        const nowVisible = !overlay.classList.contains('visible');
        overlay.classList.toggle('visible', nowVisible);
        overlay.setAttribute('aria-hidden', nowVisible ? 'false' : 'true');
        if (nowVisible) startRotation(); else stopRotation();
    }

    document.addEventListener('keydown', (e) => {
        // Ignore when typing
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;

        if (e.shiftKey && e.code === 'KeyH' && !e.repeat) {
            e.preventDefault();
            toggleWifiOverlay();
        }
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    window.pokerClient = new PokerClient();
});
