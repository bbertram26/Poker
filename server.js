const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const winston = require('winston');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// ========== PANIC MODE CONSOLE HANDLER ==========
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let panicModeActive = false;

rl.on('line', (input) => {
    const command = input.trim().toUpperCase();
    
    if (command === 'PANIC' && !panicModeActive) {
        activatePanicMode();
    } else if (command === 'STATUS') {
        console.log(`\x1b[36m📊 Server Status: ${rooms.size} active rooms, ${playerSockets.size} connected players\x1b[0m`);
    } else if (command === 'HELP') {
        console.log(`\x1b[33m📋 Available Commands:\x1b[0m`);
        console.log(`  \x1b[32mPANIC\x1b[0m  - Shutdown poker site and start anti-gambling ministry`);
        console.log(`  \x1b[32mSTATUS\x1b[0m - Show current server status`);
        console.log(`  \x1b[32mHELP\x1b[0m   - Show this help message`);
    }
});

function activatePanicMode() {
    if (panicModeActive) return;
    panicModeActive = true;
    
    console.log('\n');
    console.log(`\x1b[41m\x1b[37m\x1b[1m ⚠️  PANIC MODE ACTIVATED ⚠️  \x1b[0m`);
    console.log(`\x1b[43m\x1b[30m\x1b[1m 🛑 Shutting down poker site and redirecting to ministry... \x1b[0m`);
    
    // Immediately redirect all connected clients to the ministry site
    io.emit('panicRedirect', {
        message: 'Thanks for using Russell County Schools WiFi.',
        redirectUrl: 'SAME_HOST:3001' // Will be replaced by client with current host
    });
    
    // Log any active rooms before shutdown
    if (rooms.size > 0) {
        console.log(`\x1b[33m🏠 Disbanding ${rooms.size} active room(s) for emergency shutdown...\x1b[0m`);
        rooms.forEach(room => {
            room.logRoomDisbanding();
        });
    }
    
    // Give clients time to receive the redirect
    setTimeout(() => {
        // Start the panic site
        startPanicSite();
        
        // Shutdown this server
        setTimeout(() => {
            process.exit(0);
        }, 500);
    }, 1000);
}

function startPanicSite() {
    const panicSitePath = path.join(__dirname, 'panic');
        
    // Start the panic site server
    const panicServer = spawn('node', ['server.js'], {
        cwd: panicSitePath,
        stdio: 'inherit',
        detached: true
    });
    
    panicServer.unref(); // Allow parent to exit while child continues
}

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const colors = {
                info: '\x1b[96m',     // bright cyan
                warn: '\x1b[93m',     // bright yellow
                error: '\x1b[91m',    // bright red
                debug: '\x1b[95m',    // bright magenta
                reset: '\x1b[0m',
                dim: '\x1b[2m',
                bright: '\x1b[1m'
            };
            
            const levelIcons = {
                info: '●',
                warn: '▲',
                error: '✗',
                debug: '◆'
            };
            
            const color = colors[level] || colors.reset;
            const icon = levelIcons[level] || '●';
            const timeFormatted = `${colors.dim}${timestamp}${colors.reset}`;
            const levelFormatted = `${color}${icon}${colors.reset}`;
            
            return `${timeFormatted} ${levelFormatted} ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console()
    ]
});

const pokerLog = {
    header(txt) {
        console.log(`\n\x1b[44m\x1b[37m\x1b[1m ${txt.padEnd(60)} \x1b[0m`);
    },
    
    board(cards) {
        const cardStr = cards.length 
            ? cards.map(c => `\x1b[43m\x1b[30m ${c.rank}${c.suit} \x1b[0m`).join(' ')
            : '\x1b[2m(no community cards)\x1b[0m';
        console.log(`\n🎯 Board: ${cardStr}`);
    },
    
    divider() {
        console.log('\x1b[2m' + '─'.repeat(70) + '\x1b[0m');
    },
    
    player(player, handEval, isWinner, isFolded) {
        const bullet = isWinner ? '\x1b[32m●\x1b[0m' : '\x1b[37m○\x1b[0m';
        const status = isFolded ? '\x1b[31mFOLDED\x1b[0m' : 
                      (isWinner ? '\x1b[32mWINNER\x1b[0m' : '\x1b[37mLOST\x1b[0m');
        
        // ALWAYS show all cards in the log - never hide
        const cards = player.cards.map(c => `${c.rank}${c.suit}`).join(' ');
        const hand = isFolded ? 'Folded' : handEval.name;
        
        // Use actual string lengths (not including ANSI codes) for proper alignment
        const nameStr = player.name.padEnd(15);
        const cardsStr = cards.padEnd(8);
        const handStr = hand.padEnd(18);
        
        console.log(`  ${bullet} \x1b[1m${nameStr}\x1b[0m \x1b[33m${cardsStr}\x1b[0m \x1b[35m${handStr}\x1b[0m ${status}`);
    },
    
    result(winners, winningHand, pot, isFoldWin) {
        this.divider();
        if (isFoldWin) {
            console.log(`\x1b[42m\x1b[30m\x1b[1m 🎯 ${winners[0].name} wins by elimination! \x1b[0m`);
        } else if (winners.length === 1) {
            console.log(`\x1b[42m\x1b[30m\x1b[1m 🏆 ${winners[0].name} wins with ${winningHand.name}! \x1b[0m`);
        } else {
            console.log(`\x1b[43m\x1b[30m\x1b[1m 🤝 Split pot: ${winners.map(w => w.name).join(' & ')} (${winningHand.name}) \x1b[0m`);
        }
        console.log(`\x1b[33m\x1b[1m 💰 Pot: $${pot}\x1b[0m\n`);
    }
};

const rooms = new Map();
const playerSockets = new Map();

class PokerRoom {
    constructor(id, name, hostId) {
        this.id = id;
        this.name = name;
        this.hostId = hostId;
        this.players = [];
        this.gameActive = false;
        this.gameState = null;
        // Secure IOU system: Map of debtor -> Map of creditor -> amount owed
        // This ensures all debts are direct relationships between players
        this.debtLedger = new Map(); // playerId -> Map(creditorId -> amount)
        this.settings = {
            allowMidGameJoining: true
        };
        this.autoDealing = true;
        this.dealerPosition = 0; // Track dealer rotation
        this.firstToActOffset = 1; // 1 = left of dealer (first hand), then rotates each hand
    }

    addPlayer(playerId, playerName, socketId) {
        if (this.players.length >= 8) return false;
        
        // Check if mid-game joining is allowed
        if (this.gameActive && !this.settings.allowMidGameJoining) {
            return false; // Don't allow joining if game is active and setting is disabled
        }
        
        const player = {
            id: playerId,
            name: playerName,
            isHost: playerId === this.hostId,
            socketId: socketId,
            cards: [],
            betThisRound: 0, // What they've bet in current betting round
            totalPaidThisHand: 0, // Total paid this entire hand
            hasFolded: false,
            hasActedThisRound: false,
            inWaitingRoom: this.gameActive && this.settings.allowMidGameJoining // Put in waiting room if game active and allowed
        };
        
        this.players.push(player);
        
        // Initialize debt ledger for new player (they owe nothing to nobody)
        if (!this.debtLedger.has(playerId)) {
            this.debtLedger.set(playerId, new Map());
        }
        
        return true;
    }

    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index === -1) return null;
        
        const wasActivePlayer = this.gameActive && this.gameState && this.gameState.activePlayerIndex === index;
        
        this.players.splice(index, 1);
        
        // Adjust activePlayerIndex if needed
        if (this.gameActive && this.gameState) {
            if (this.gameState.activePlayerIndex >= index) {
                this.gameState.activePlayerIndex = Math.max(0, this.gameState.activePlayerIndex - 1);
            }
            
            // If it was the active player's turn, find next valid player
            if (wasActivePlayer && this.players.length > 0) {
                this.nextPlayer();
            }
        }
        
        // If less than 2 players remain, end the game
        if (this.players.length < 2 && this.gameActive) {
            this.gameActive = false;
            this.gameState = null;
        }
        
        return null;
    }

    startGame() {
        if (this.players.length < 2) return false;
        
        // FIXED: Dealer is ALWAYS the host (Dummy 1)
        const dealerIndex = this.players.findIndex(p => p.id === this.hostId);

        this.gameActive = true;
        this.gameState = {
            phase: 'preflop',
            pot: 0,
            currentBet: 1,
            activePlayerIndex: -1,
            dealerIndex: dealerIndex, // Host is always dealer
            communityCards: [],
            deck: this.createDeck(),
            round: 1
        };

        this.resetForNewHand();
        this.dealCards();

        // FIXED: Set first-to-act using proper rotation formula
        this.setFirstToActWithRotation();

        const firstToActName = this.players[this.gameState.activePlayerIndex].name;
        logger.info(`GAME: Hand #${this.gameState.round} has started, first to act: ${firstToActName}.`);
        return true;
    }

    // FIXED: Implement proper rotation formula from rules
    setFirstToActWithRotation() {
        const activePlayers = this.players.filter(p => !p.inWaitingRoom && !p.hasFolded);
        const N = activePlayers.length;
        if (N < 2) return;

        // Apply rotation formula: starter_num = (N + (game_number - 1)) % N
        let starterNum = (N + (this.gameState.round - 1)) % N;
        if (starterNum === 0) {
            starterNum = N;
        }

        // Host (dealer) is always position 1, find the starter position
        const hostIndex = this.players.findIndex(p => p.id === this.hostId);
        
        // Map starter position to actual player index
        // starterNum 1 = host, starterNum 2 = next active player, etc.
        let starterIndex = hostIndex;
        
        // Move starterNum-1 positions from host to find starter
        for (let i = 1; i < starterNum; i++) {
            starterIndex = this.getNextActivePlayer(starterIndex);
            if (starterIndex === -1) break; // Safety check
        }

        this.gameState.activePlayerIndex = starterIndex;
        this.gameState.firstToActThisPhase = starterIndex;
    }

    setFirstToActPostflop() {
        // Post-flop: Use same rotation formula but for post-flop phases
        const activePlayers = this.players.filter(p => !p.hasFolded && !p.inWaitingRoom);
        if (activePlayers.length === 0) return;
        
        // Start with the original first-to-act from preflop
        let startIndex = this.gameState.firstToActThisPhase;
        
        // If that player has folded, find the next active player
        if (this.players[startIndex].hasFolded || this.players[startIndex].inWaitingRoom) {
            startIndex = this.getNextActivePlayer(startIndex);
            if (startIndex === -1) {
                // No active players found
                return;
            }
        }
        
        this.gameState.activePlayerIndex = startIndex;
    }

    getNextActivePlayer(fromIndex) {
        const totalPlayers = this.players.length;
        let nextIndex = (fromIndex + 1) % totalPlayers;
        let attempts = 0;
        
        while (attempts < totalPlayers) {
            const player = this.players[nextIndex];
            if (!player.hasFolded && !player.inWaitingRoom) {
                return nextIndex;
            }
            nextIndex = (nextIndex + 1) % totalPlayers;
            attempts++;
        }
        
        // Fallback - return first active player found
        for (let i = 0; i < totalPlayers; i++) {
            if (!this.players[i].hasFolded && !this.players[i].inWaitingRoom) {
                return i;
            }
        }
        
        return -1; // No active players found
    }

    resetForNewHand() {
        this.players.forEach(player => {
            if (!player.inWaitingRoom) {
                player.betThisRound = 0;
                player.totalPaidThisHand = 0;
                player.hasFolded = false;
                player.hasActedThisRound = false;
                player.cards = [];
            }
        });
    }

    resetForNewBettingRound() {
        this.players.forEach(p => {
            p.betThisRound = 0;
            p.hasActedThisRound = false; // Reset this for new betting round
        });
        this.gameState.currentBet = 0;
    }

    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck = [];
        
        suits.forEach(suit => {
            ranks.forEach(rank => {
                deck.push({ suit, rank });
            });
        });
        
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        return deck;
    }

    dealCards() {
        // Only deal cards to players not in waiting room
        this.players.forEach(player => {
            if (!player.inWaitingRoom) {
                player.cards = [this.gameState.deck.pop(), this.gameState.deck.pop()];
            }
        });
    }

    processAction(playerId, action, amount = 0) {
        if (!this.gameActive) return null;
        
        const activePlayer = this.players[this.gameState.activePlayerIndex];
        if (!activePlayer || activePlayer.id !== playerId || activePlayer.hasFolded) {
            logger.error(`ERROR: Invalid player action: ${playerId}, active: ${activePlayer?.name}, folded: ${activePlayer?.hasFolded}.`);
            return null;
        }

        let result = null;

        if (this.gameState.phase === 'preflop') {
            // PRE-FLOP: ONLY call $1 or fold - NO checking allowed
            switch (action) {
                case 'fold':
                    activePlayer.hasFolded = true;
                    activePlayer.hasActedThisRound = true; // <-- ensure turn advances
                    result = { action: 'fold', player: activePlayer.name };
                    logger.info(`GAME: ${activePlayer.name} folds pre-flop.`);
                    break;

                case 'call':
                    // Must call $1 to see flop
                    if (activePlayer.betThisRound === 0) {
                        const callAmount = 1;
                        activePlayer.betThisRound = callAmount;
                        activePlayer.totalPaidThisHand += callAmount;
                        this.gameState.pot += callAmount;
                        this.gameState.currentBet = callAmount;
                        activePlayer.hasActedThisRound = true; // <-- ensure turn advances
                        result = { action: 'call', player: activePlayer.name, amount: callAmount };
                        logger.info(`GAME: ${activePlayer.name} calls $1 pre-flop.`);
                    }
                    break;
                // NO CHECK OR RAISE ON PRE-FLOP
            }
        } else {
            // POST-FLOP: Normal poker betting
            switch (action) {
                case 'fold':
                    // Can only fold if there's a bet to call
                    if (this.gameState.currentBet > activePlayer.betThisRound) {
                        activePlayer.hasFolded = true;
                        activePlayer.hasActedThisRound = true;
                        result = { action: 'fold', player: activePlayer.name };
                        logger.info(`GAME: ${activePlayer.name} has folded.`);
                    }
                    break;

                case 'check':
                    // Can only check if no bet to call
                    if (this.gameState.currentBet === activePlayer.betThisRound) {
                        activePlayer.hasActedThisRound = true;
                        result = { action: 'check', player: activePlayer.name };
                        logger.info(`GAME: ${activePlayer.name} checks.`);
                    }
                    break;

                case 'call':
                    const callAmount = this.gameState.currentBet - activePlayer.betThisRound;
                    if (callAmount > 0) {
                        activePlayer.betThisRound = this.gameState.currentBet;
                        activePlayer.totalPaidThisHand += callAmount;
                        this.gameState.pot += callAmount;
                        activePlayer.hasActedThisRound = true;
                        result = { action: 'call', player: activePlayer.name, amount: callAmount };
                        logger.info(`GAME: ${activePlayer.name} calls raise of $${callAmount}.`);
                    }
                    break;

                    case 'raise': {
                        // Hard cap per hand
                        if (activePlayer.totalPaidThisHand >= 100) break;
                    
                        const prevCurrentBet = this.gameState.currentBet || 0;
                    
                        let raiseBy = Number(amount) || 0;
                        if (raiseBy <= 0) break;
                    
                        const remainingCap = 100 - activePlayer.totalPaidThisHand;
                    
                        // Target bet this player is setting
                        const targetBet = prevCurrentBet + raiseBy;
                    
                        // Chips needed from this player to reach target
                        const needed = targetBet - (activePlayer.betThisRound || 0);
                        if (needed <= 0) {
                            // Already at/above target relative to their contribution
                            activePlayer.hasActedThisRound = true;
                            break;
                        }
                    
                        // Pay up to remaining cap
                        const pay = Math.min(needed, remainingCap);
                    
                        // Apply payment
                        activePlayer.betThisRound = (activePlayer.betThisRound || 0) + pay;
                        activePlayer.totalPaidThisHand += pay;
                        this.gameState.pot += pay;
                    
                        // Did this action create a raise? (player's bet now exceeds previous currentBet)
                        if (activePlayer.betThisRound > prevCurrentBet) {
                            const actualRaiseBy = activePlayer.betThisRound - prevCurrentBet; // may be < raiseBy if capped
                            this.gameState.currentBet = activePlayer.betThisRound;
                            activePlayer.hasActedThisRound = true;
                    
                            // Others must act again
                            this.players.forEach(p => {
                                if (p.id !== activePlayer.id) p.hasActedThisRound = false;
                            });
                    
                            result = { action: 'raise', player: activePlayer.name, by: actualRaiseBy, to: this.gameState.currentBet };
                            logger.info(`GAME: ${activePlayer.name} raises by $${actualRaiseBy}.`);
                        } else {
                            // Could not reach a raise (partial call up to cap)
                            activePlayer.hasActedThisRound = true;
                            result = { action: 'call', player: activePlayer.name, amount: pay };
                            logger.info(`GAME: ${activePlayer.name} calls, pot is now at the max."`);
                        }
                        break;
                    }
            }
        }

        if (result) {
            const activePlayers = this.players.filter(p => !p.hasFolded && !p.inWaitingRoom);
            if (activePlayers.length <= 1) {
                result.handComplete = this.endHand(activePlayers[0]);
                return result;
            }

            // First, check if this betting round is complete BEFORE moving the turn
            if (this.isBettingRoundComplete()) {
                const phaseResult = this.nextPhase();
                if (phaseResult) {
                    // Hand finished at river
                    result.handComplete = phaseResult;
                } else {
                    // New phase started - mark that we need to announce the turn
                    result.newPhase = true;
                }
            } else {
                // Betting round not complete; move to next player within the same phase
                this.nextPlayer();
            }
        }
    
        return result;
    }

    nextPlayer() {
        if (!this.gameState) return;

        const n = this.players.length;
        if (n === 0) return;

        const start = this.gameState.activePlayerIndex;
        let step = 1;

        // Scan clockwise, skipping folded/waiting seats
        while (step <= n) {
            const idx = (start + step) % n;
            if (this.isSeatActive(idx)) {
                this.gameState.activePlayerIndex = idx;
                return;
            }
            step++;
        }

        // No valid player found -> end hand
        return this.endHand();
    }

    isSeatActive(index) {
        const p = this.players[index];
        return !!p && !p.inWaitingRoom && !p.hasFolded;
    }

    getNextActiveIndex(startIndex) {
        const n = this.players.length;
        if (!this.gameState || n === 0) return -1;
    
        for (let step = 1; step <= n; step++) {
            const idx = (startIndex + step) % n;
            if (this.isSeatActive(idx)) return idx;
        }
        return -1; // no valid player
    }

    getNextActivePlayerIndex(currentIndex) {
        return this.getNextActiveIndex(currentIndex);
    }

    isBettingRoundComplete() {
        const activePlayers = this.players.filter(p => !p.hasFolded && !p.inWaitingRoom);
        
        if (activePlayers.length <= 1) {
            return true; // Only one player left
        }
        
        // Check if all active players have acted
        const allHaveActed = activePlayers.every(p => p.hasActedThisRound);
        
        if (this.gameState.phase === 'preflop') {
            // Pre-flop: Everyone must call $1 AND have acted
            const allCalledOrFolded = activePlayers.every(p => p.betThisRound >= 1 || p.hasFolded);
            return allHaveActed && allCalledOrFolded;
        } else {
            // Post-flop: All players have acted and matched current bet
            const allMatchedBet = activePlayers.every(p => p.betThisRound === this.gameState.currentBet);
            
            // Special case: if no one has bet (all checked), just need everyone to act
            if (this.gameState.currentBet === 0) {
                return allHaveActed;
            }
            
            return allHaveActed && allMatchedBet;
        }
    }

    nextPhase() {
        switch (this.gameState.phase) {
            case 'preflop':
                this.gameState.communityCards = [
                    this.gameState.deck.pop(),
                    this.gameState.deck.pop(),
                    this.gameState.deck.pop()
                ];
                this.gameState.phase = 'flop';
                break;
            case 'flop':
                this.gameState.communityCards.push(this.gameState.deck.pop());
                this.gameState.phase = 'turn';
                break;
            case 'turn':
                this.gameState.communityCards.push(this.gameState.deck.pop());
                this.gameState.phase = 'river';
                break;
            case 'river':
                return this.endHand();
        }
        
        // Reset for new betting round
        this.gameState.currentBet = 0;
        this.players.forEach(player => {
            player.betThisRound = 0;
            player.hasActedThisRound = false;
        });
        
        // Post-flop: first to act is always left of dealer (or the next active player if dealer folded)
        this.setFirstToActPostflop();
        
        return null;
    }

    compareHighCards(cards1, cards2) {
        for (let i = 0; i < Math.max(cards1.length, cards2.length); i++) {
            const card1 = cards1[i] || 0;
            const card2 = cards2[i] || 0;
            if (card1 !== card2) {
                return card1 - card2; // Positive if cards1 is higher
            }
        }
        return 0; // Equal
    }

    endHand(winner = null) {
        const activePlayers = this.players.filter(p => !p.hasFolded && !p.inWaitingRoom);
        // Dealer no longer rotates; dealer stays the host

        const allGamePlayers = this.players.filter(p => !p.inWaitingRoom);
        let winningHand = null;
        let winners = [];

        const communitySnap = [...this.gameState.communityCards];
        const potSnap = this.gameState.pot;

        const isFoldWin = activePlayers.length === 1 && allGamePlayers.some(p => p.hasFolded);

        if (!winner && !isFoldWin) {
            // Normal showdown logic
            const playerHands = activePlayers.map(player => ({
                player: player,
                handRank: this.evaluateHand(player.cards, this.gameState.communityCards)
            }));
            
            playerHands.sort((a, b) => {
                if (a.handRank.rank !== b.handRank.rank) {
                    return b.handRank.rank - a.handRank.rank;
                }
                return this.compareHighCards(b.handRank.highCards, a.handRank.highCards);
            });
            
            const bestHandRank = playerHands[0].handRank;
            winners = playerHands.filter(ph => 
                ph.handRank.rank === bestHandRank.rank && 
                this.compareHighCards(ph.handRank.highCards || [], bestHandRank.highCards || []) === 0
            ).map(ph => ph.player);
            
            winningHand = bestHandRank;
        } else if (isFoldWin) {
            // Everyone folded except one
            winners = [activePlayers[0]];
            winningHand = { name: 'Elimination', rank: 0 };
        } else {
            // Manual winner set
            winners = [winner];
            winningHand = { name: 'Elimination', rank: 0 };
        }

        pokerLog.header('🎰 HAND RESULTS');
        pokerLog.board(communitySnap);
        pokerLog.divider();
        
        allGamePlayers.forEach(player => {
            const handEval = this.evaluateHand(player.cards, this.gameState.communityCards);
            const isWinner = winners.some(w => w.id === player.id);
            pokerLog.player(player, handEval, isWinner, player.hasFolded);
        });
        
        if (!winner) {
            // Evaluate all hands and find the best one(s)
            const playerHands = activePlayers.map(player => ({
                player: player,
                handRank: this.evaluateHand(player.cards, this.gameState.communityCards)
            }));
            
            playerHands.sort((a, b) => {
                if (a.handRank.rank !== b.handRank.rank) {
                    return b.handRank.rank - a.handRank.rank;
                }
                return this.compareHighCards(b.handRank.highCards, a.handRank.highCards);
            });
            
            const bestHandRank = playerHands[0].handRank;
            winners = playerHands.filter(ph => 
                ph.handRank.rank === bestHandRank.rank && 
                this.compareHighCards(ph.handRank.highCards || [], bestHandRank.highCards || []) === 0
            ).map(ph => ph.player);
            
            winningHand = bestHandRank;
            if (winners.length === 1) {
                winner = winners[0];
            }
        } else {
            winningHand = { name: 'Last Player Standing', rank: 0 };
            winners = [winner];
        }

        pokerLog.result(winners, winningHand, potSnap, isFoldWin);

        // Calculate debt adjustments for IOU system with proper double-entry bookkeeping
        this.calculateSecureDebtTransfer(winners);

        const contributions = this.players.map(p => ({
            name: p.name,
            amount: p.totalPaidThisHand
        }));

        // Only include players who were actually dealt cards (not in waiting room)
        const allHands = this.players
            .filter(player => !player.inWaitingRoom && player.cards && player.cards.length >= 2)
            .map(player => ({
                name: player.name,
                cards: player.cards,
                handType: player.hasFolded ? 'Folded' : this.evaluateHand(player.cards, this.gameState.communityCards).name,
                folded: player.hasFolded
            }));

        this.autoDealing = true;

        return {
            winner: winners.length > 1 ? winners.map(w => w.name).join(', ') : winner.name,
            winners: winners.map(w => w.name),
            isPush: winners.length > 1,
            winningHand: winningHand,
            potAmount: this.gameState.pot,
            contributions: contributions,
            overallDebt: this.getDebtSummary(),
            directDebts: this.getDirectDebtRelationships(),
            allHands: allHands
        };
    }

    /**
     * Secure debt transfer calculation with automatic consolidation
     * Creates direct IOUs from losers to winners, but consolidates debts between same players
     * Example: If A owes B $5, then B loses $3 to A, result is A owes B $2
     */
    calculateSecureDebtTransfer(winners) {
        // Calculate contributions and winnings for this hand only
        const playerContributions = new Map();
        const playerWinnings = new Map();
        
        // Calculate total contributions
        let totalPot = 0;
        this.players.forEach(player => {
            const contributed = player.totalPaidThisHand || 0;
            if (contributed > 0) {
                playerContributions.set(player.id, contributed);
                totalPot += contributed;
            }
        });
        
        // Calculate exact winnings per winner
        const winnerShare = Math.floor(totalPot / winners.length);
        const remainder = totalPot % winners.length;
        
        // Distribute winnings (first winner gets remainder if any)
        winners.forEach((winner, index) => {
            const extraCent = index === 0 ? remainder : 0;
            playerWinnings.set(winner.id, winnerShare + extraCent);
        });
        
        // Create direct debt relationships from each loser to each winner
        // This preserves the actual hand-by-hand debt history
        const losers = [];
        this.players.forEach(player => {
            const contributed = playerContributions.get(player.id) || 0;
            const won = playerWinnings.get(player.id) || 0;
            
            if (contributed > 0 && won === 0) {
                // This player lost money this hand
                losers.push({
                    playerId: player.id,
                    lostAmount: contributed
                });
            }
        });
        
        // Each loser owes each winner proportionally
        losers.forEach(loser => {
            const totalLostByThisPlayer = loser.lostAmount;
            
            winners.forEach(winner => {
                const winnerTotalWon = playerWinnings.get(winner.id) || 0;
                const winnerProportion = winnerTotalWon / totalPot;
                const amountOwedToThisWinner = Math.round(totalLostByThisPlayer * winnerProportion);
                
                if (amountOwedToThisWinner > 0) {
                    // Create direct debt: loser owes winner this specific amount
                    this.addDebt(loser.playerId, winner.id, amountOwedToThisWinner);
                }
            });
        });
        
        // Validation: Ensure the books balance
        this.validateDebtLedger();
    }
    
    /**
     * Add a debt relationship between two players with automatic consolidation
     * If Player A owes Player B $5, and then Player B owes Player A $3,
     * the result will be Player A owes Player B $2
     */
    addDebt(debtorId, creditorId, amount) {
        if (amount <= 0) return;
        
        // Ensure both players have entries in the ledger
        if (!this.debtLedger.has(debtorId)) {
            this.debtLedger.set(debtorId, new Map());
        }
        if (!this.debtLedger.has(creditorId)) {
            this.debtLedger.set(creditorId, new Map());
        }
        
        const debtorDebts = this.debtLedger.get(debtorId);
        const creditorDebts = this.debtLedger.get(creditorId);
        
        // Check if there's an existing debt in the opposite direction
        const oppositeDebt = creditorDebts.get(debtorId) || 0;
        const currentDebt = debtorDebts.get(creditorId) || 0;
        
        if (oppositeDebt > 0) {
            // There's a debt in the opposite direction - consolidate
            if (amount > oppositeDebt) {
                // New debt is larger - creditor will now owe the difference
                const netDebt = amount - oppositeDebt;
                creditorDebts.delete(debtorId); // Remove opposite debt
                debtorDebts.set(creditorId, currentDebt + netDebt);
            } else if (amount < oppositeDebt) {
                // Opposite debt is larger - reduce the opposite debt
                const remainingOppositeDebt = oppositeDebt - amount;
                creditorDebts.set(debtorId, remainingOppositeDebt);
                // Don't add to current debt since it's canceled out
            } else {
                // Debts are equal - cancel each other out
                creditorDebts.delete(debtorId);
                // Don't add to current debt since it's canceled out
            }
        } else {
            // No opposite debt - just add to existing debt
            debtorDebts.set(creditorId, currentDebt + amount);
        }
        
        // Clean up empty debt maps
        if (debtorDebts.size === 0) {
            this.debtLedger.delete(debtorId);
        }
        if (creditorDebts.size === 0) {
            this.debtLedger.delete(creditorId);
        }
    }
    
    /**
     * Transfer debt between players (for manual settlement)
     */
    transferDebt(fromPlayerId, toPlayerId, creditorId, amount) {
        if (amount <= 0) return false;
        
        const fromDebts = this.debtLedger.get(fromPlayerId);
        if (!fromDebts || !fromDebts.has(creditorId)) return false;
        
        const currentDebt = fromDebts.get(creditorId);
        if (currentDebt < amount) return false;
        
        // Reduce original debtor's debt
        if (currentDebt === amount) {
            fromDebts.delete(creditorId);
        } else {
            fromDebts.set(creditorId, currentDebt - amount);
        }
        
        // Add debt to new debtor
        this.addDebt(toPlayerId, creditorId, amount);
        
        this.validateDebtLedger();
        return true;
    }
    
    /**
     * Settle a debt (mark as paid)
     */
    settleDebt(debtorId, creditorId, amount) {
        if (amount <= 0) return false;
        
        const debtorDebts = this.debtLedger.get(debtorId);
        if (!debtorDebts || !debtorDebts.has(creditorId)) return false;
        
        const currentDebt = debtorDebts.get(creditorId);
        if (currentDebt < amount) return false;
        
        if (currentDebt === amount) {
            debtorDebts.delete(creditorId);
        } else {
            debtorDebts.set(creditorId, currentDebt - amount);
        }
        
        this.validateDebtLedger();
        return true;
    }
    
    /**
     * Validate that the debt ledger maintains mathematical integrity
     */
    validateDebtLedger() {
        // In a proper IOU system, total debt should equal total credit
        let totalDebt = 0;
        let totalCredit = 0;
        
        this.debtLedger.forEach((debts, debtorId) => {
            debts.forEach((amount, creditorId) => {
                totalDebt += amount;
            });
        });
        
        // Calculate total credit (sum of what each player is owed)
        const creditMap = new Map();
        this.debtLedger.forEach((debts, debtorId) => {
            debts.forEach((amount, creditorId) => {
                creditMap.set(creditorId, (creditMap.get(creditorId) || 0) + amount);
            });
        });
        
        creditMap.forEach(amount => totalCredit += amount);
        
        if (Math.abs(totalDebt - totalCredit) > 0.01) {
            console.error(`DEBT LEDGER INTEGRITY ERROR: Total debt ${totalDebt} != Total credit ${totalCredit}`);
        }
    }
    
    evaluateHand(playerCards, communityCards) {
        const allCards = [...playerCards, ...communityCards];
        const ranks = allCards.map(card => this.getNumericRank(card.rank)).sort((a, b) => b - a);
        
        const rankCounts = {};
        const suitCounts = {};
        const suitGroups = {};
        
        allCards.forEach(card => {
            const rank = this.getNumericRank(card.rank);
            const suit = card.suit;
            
            // Count ranks
            rankCounts[rank] = (rankCounts[rank] || 0) + 1;
            
            // Count suits
            suitCounts[suit] = (suitCounts[suit] || 0) + 1;
            
            // Group cards by suit
            if (!suitGroups[suit]) suitGroups[suit] = [];
            suitGroups[suit].push(rank);
        });
    
        const getHighCards = (excludeRanks = []) => {
            return ranks.filter(r => !excludeRanks.includes(r));
        };
    
        // Check for straight flush
        let straightFlushHigh = 0;
        let isRoyalFlush = false;
        
        for (const suit in suitGroups) {
            if (suitGroups[suit].length >= 5) {
                const suitRanks = [...new Set(suitGroups[suit])].sort((a, b) => b - a);
                
                // Check for consecutive cards in this suit
                for (let i = 0; i <= suitRanks.length - 5; i++) {
                    if (suitRanks[i] - suitRanks[i + 4] === 4) {
                        straightFlushHigh = Math.max(straightFlushHigh, suitRanks[i]);
                        if (suitRanks[i] === 14) isRoyalFlush = true;
                    }
                }
                
                // Check for A-2-3-4-5 straight flush (wheel)
                if (suitRanks.includes(14) && suitRanks.includes(5) && 
                    suitRanks.includes(4) && suitRanks.includes(3) && suitRanks.includes(2)) {
                    straightFlushHigh = Math.max(straightFlushHigh, 5);
                }
            }
        }
    
        // Royal Flush
        if (isRoyalFlush && straightFlushHigh === 14) {
            return { name: 'Royal Flush', rank: 10, highCards: [14] };
        }
    
        // Straight Flush
        if (straightFlushHigh > 0) {
            return { name: 'Straight Flush', rank: 9, highCards: [straightFlushHigh] };
        }
    
        // Four of a Kind
        const quads = Object.keys(rankCounts).find(r => rankCounts[r] === 4);
        if (quads) {
            const quadRank = parseInt(quads);
            const kicker = getHighCards([quadRank])[0];
            return { name: 'Four of a Kind', rank: 8, highCards: [quadRank, kicker] };
        }
    
        // Full House
        const trips = Object.keys(rankCounts).filter(r => rankCounts[r] === 3).map(r => parseInt(r));
        const pairs = Object.keys(rankCounts).filter(r => rankCounts[r] === 2).map(r => parseInt(r));
        
        if (trips.length > 0 && (pairs.length > 0 || trips.length > 1)) {
            const highTrips = Math.max(...trips);
            let fullHousePair;
            
            if (trips.length > 1) {
                // Multiple trips - use second highest as pair
                fullHousePair = Math.max(...trips.filter(t => t !== highTrips));
            } else {
                // Use highest pair
                fullHousePair = Math.max(...pairs);
            }
            
            return { name: 'Full House', rank: 7, highCards: [highTrips, fullHousePair] };
        }
    
        // Flush
        const flushSuit = Object.keys(suitCounts).find(suit => suitCounts[suit] >= 5);
        if (flushSuit) {
            const flushCards = suitGroups[flushSuit].sort((a, b) => b - a).slice(0, 5);
            return { name: 'Flush', rank: 6, highCards: flushCards };
        }
    
        // Straight
        const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
        let straightHigh = 0;
        
        // Check for normal straights
        for (let i = 0; i <= uniqueRanks.length - 5; i++) {
            if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
                straightHigh = uniqueRanks[i];
                break;
            }
        }
        
        // Check for A-2-3-4-5 straight (wheel)
        if (!straightHigh && uniqueRanks.includes(14) && uniqueRanks.includes(5) && 
            uniqueRanks.includes(4) && uniqueRanks.includes(3) && uniqueRanks.includes(2)) {
            straightHigh = 5;
        }
    
        if (straightHigh > 0) {
            return { name: 'Straight', rank: 5, highCards: [straightHigh] };
        }
    
        // Three of a Kind
        if (trips.length > 0) {
            const tripRank = Math.max(...trips);
            const kickers = getHighCards([tripRank]).slice(0, 2);
            return { name: 'Three of a Kind', rank: 4, highCards: [tripRank, ...kickers] };
        }
    
        // Two Pair
        if (pairs.length >= 2) {
            const sortedPairs = pairs.sort((a, b) => b - a);
            const highPair = sortedPairs[0];
            const lowPair = sortedPairs[1];
            const kicker = getHighCards([highPair, lowPair])[0];
            return { name: 'Two Pair', rank: 3, highCards: [highPair, lowPair, kicker] };
        }
    
        // One Pair
        if (pairs.length === 1) {
            const pairRank = pairs[0];
            const kickers = getHighCards([pairRank]).slice(0, 3);
            return { name: 'One Pair', rank: 2, highCards: [pairRank, ...kickers] };
        }
    
        // High Card
        return { name: 'High Card', rank: 1, highCards: getHighCards().slice(0, 5) };
    }

    getNumericRank(rank) {
        const rankMap = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
            'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };
        return rankMap[rank] || 0;
    }

    checkFlush(allCards) {
        const suitCounts = {};
        allCards.forEach(card => {
            suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
        });
        
        const flushSuit = Object.keys(suitCounts).find(suit => suitCounts[suit] >= 5);
        if (!flushSuit) return false;
        
        // Get all cards of the flush suit and return the 5 highest
        const flushCards = allCards.filter(card => card.suit === flushSuit)
            .map(card => this.getNumericRank(card.rank))
            .sort((a, b) => b - a)
            .slice(0, 5);
        
        return flushCards; // Return the actual 5 cards that make the flush
    }

    checkStraight(ranks) {
        if (ranks.length < 5) return false;
        
        // Remove duplicates and sort descending
        const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
        
        // Check for regular straights (starting from highest possible)
        for (let i = 0; i <= uniqueRanks.length - 5; i++) {
            let consecutive = true;
            for (let j = 1; j < 5; j++) {
                if (uniqueRanks[i + j] !== uniqueRanks[i] - j) {
                    consecutive = false;
                    break;
                }
            }
            if (consecutive) {
                return uniqueRanks[i]; // Return the HIGH card of the straight
            }
        }
        
        // Check for Ace-low straight (A-2-3-4-5)
        if (uniqueRanks.includes(14) && uniqueRanks.includes(5) && uniqueRanks.includes(4) && uniqueRanks.includes(3) && uniqueRanks.includes(2)) {
            return 5; // High card is 5 for wheel
        }
        
        return false;
    }

    getDebtSummary() {
        const summary = [];
        
        // Calculate net position for each player from the debt ledger
        const netPositions = new Map();
        
        // Initialize all current players with zero debt
        this.players.forEach(player => {
            netPositions.set(player.id, { name: player.name, netAmount: 0 });
        });
        
        // Calculate net positions from debt ledger
        this.debtLedger.forEach((debts, debtorId) => {
            debts.forEach((amount, creditorId) => {
                // Debtor owes money (negative contribution to net)
                if (!netPositions.has(debtorId)) {
                    netPositions.set(debtorId, { name: debtorId, netAmount: 0 });
                }
                const debtorPos = netPositions.get(debtorId);
                debtorPos.netAmount -= amount;
                
                // Creditor is owed money (positive contribution to net)
                if (!netPositions.has(creditorId)) {
                    netPositions.set(creditorId, { name: creditorId, netAmount: 0 });
                }
                const creditorPos = netPositions.get(creditorId);
                creditorPos.netAmount += amount;
            });
        });
        
        // Convert to summary format compatible with existing UI
        netPositions.forEach((position, playerId) => {
            summary.push({
                name: position.name,
                amount: position.netAmount
            });
        });
        
        return summary.sort((a, b) => b.amount - a.amount);
    }

    /**
     * Get direct debt relationships for UI display (no net calculation)
     * Returns actual IOUs between players
     */
    getDirectDebtRelationships() {
        const relationships = [];
        
        // Get all current players for name lookup
        const playerNames = new Map();
        this.players.forEach(player => {
            playerNames.set(player.id, player.name);
        });
        
        // Convert debt ledger to relationship format
        this.debtLedger.forEach((debts, debtorId) => {
            debts.forEach((amount, creditorId) => {
                if (amount > 0) {
                    const debtorName = playerNames.get(debtorId) || debtorId;
                    const creditorName = playerNames.get(creditorId) || creditorId;
                    
                    relationships.push({
                        debtor: debtorName,
                        creditor: creditorName,
                        amount: amount
                    });
                }
            });
        });
        
        return relationships;
    }

    getDetailedDebtBreakdown() {
        const breakdown = new Map();
        
        // Initialize breakdown for all players (current and those with outstanding debts)
        this.players.forEach(player => {
            breakdown.set(player.name, {
                owes: [],
                owedBy: [],
                netAmount: 0
            });
        });
        
        // Process the debt ledger directly to create the breakdown
        this.debtLedger.forEach((debts, debtorId) => {
            debts.forEach((amount, creditorId) => {
                if (amount <= 0) return;
                
                // Get player names
                const debtorPlayer = this.players.find(p => p.id === debtorId);
                const creditorPlayer = this.players.find(p => p.id === creditorId);
                
                const debtorName = debtorPlayer ? debtorPlayer.name : debtorId;
                const creditorName = creditorPlayer ? creditorPlayer.name : creditorId;
                
                // Ensure both players have entries
                if (!breakdown.has(debtorName)) {
                    breakdown.set(debtorName, { owes: [], owedBy: [], netAmount: 0 });
                }
                if (!breakdown.has(creditorName)) {
                    breakdown.set(creditorName, { owes: [], owedBy: [], netAmount: 0 });
                }
                
                // Record the debt relationship
                breakdown.get(debtorName).owes.push({
                    to: creditorName,
                    amount: amount
                });
                
                breakdown.get(creditorName).owedBy.push({
                    from: debtorName,
                    amount: amount
                });
                
                // Update net amounts
                breakdown.get(debtorName).netAmount -= amount;
                breakdown.get(creditorName).netAmount += amount;
            });
        });
        
        return breakdown;
    }

    logRoomDisbanding() {
        const hostName = this.players.find(p => p.id === this.hostId)?.name || 'Unknown';
        
        pokerLog.header(`💸 ROOM DISBANDED`);
        console.log(`\x1b[43m\x1b[30m\x1b[1m 🏠 Disbanded ${this.name} with code ${this.id} hosted by ${hostName} \x1b[0m`);
        pokerLog.divider();
    
        
        const debtBreakdown = this.getDetailedDebtBreakdown();
        let hasDebts = false;
        
        debtBreakdown.forEach((playerData, playerName) => {
            if (playerData.owes.length > 0 || playerData.owedBy.length > 0) {
                hasDebts = true;
                console.log(`\n\x1b[1m💰 ${playerName}:\x1b[0m`);
                
                if (playerData.owes.length > 0) {
                    playerData.owes.forEach(debt => {
                        console.log(`  \x1b[31m• Owes ${debt.to} a total of $${debt.amount}\x1b[0m`);
                    });
                }
                
                if (playerData.owedBy.length > 0) {
                    playerData.owedBy.forEach(credit => {
                        console.log(`  \x1b[32m• Is owed by ${credit.from} a total of $${credit.amount}\x1b[0m`);
                    });
                }
            }
        });
        
        if (!hasDebts) {
            console.log(`\x1b[2m💸 No outstanding debts - everyone's even!\x1b[0m`);
        }
        
        pokerLog.divider();
        console.log('');
    }

    autoDealNextHand() {
        // This will be called by the socket handler
        this.autoDealing = true;
    }

    newHand() {
        // Move waiting room players into the game
        this.players.forEach(player => {
            if (player.inWaitingRoom) {
                player.inWaitingRoom = false;
            }
        });
        
        const activePlayers = this.players.filter(p => !p.inWaitingRoom);
        if (activePlayers.length < 2) {
            return false;
        }
        
        this.gameState.round++;
        this.gameState.phase = 'preflop';
        this.gameState.pot = 0;
        this.gameState.currentBet = 0;
        
        // FIXED: Dealer stays the host - NO ROTATION
        // Host is always dealer (Dummy 1 rule)
        const hostIndex = this.players.findIndex(p => p.id === this.hostId);
        this.gameState.dealerIndex = hostIndex;
        
        this.gameState.communityCards = [];
        this.gameState.deck = this.createDeck();
        
        this.resetForNewHand();
        this.dealCards();
        
        // FIXED: Set first to act using proper rotation formula
        this.setFirstToActWithRotation();
        
        const firstToActName = this.players[this.gameState.activePlayerIndex].name;
        logger.info(`GAME: Hand #${this.gameState.round} has started, first to act: ${firstToActName}.`);
        return true;
    }
}

io.on('connection', (socket) => {
    socket.on('createRoom', (data) => {
        const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        const room = new PokerRoom(roomCode, data.roomName, data.hostName);
        const roomName = data.roomName;
        
        room.addPlayer(data.hostName, data.hostName, socket.id);
        rooms.set(roomCode, room);
        playerSockets.set(socket.id, { playerId: data.hostName, roomId: roomCode });
        
        socket.join(roomCode);
        
        logger.info('ROOM: Created ' + roomName + ' with code ' + roomCode + ' with host ' + data.hostName + '.');
        socket.emit('roomCreated', {
            roomCode: roomCode,
            roomName: data.roomName,
            players: room.players
        });
    });

    socket.on('joinRoom', (data) => {
        const room = rooms.get(data.roomCode);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (room.players.length >= 8) {
            socket.emit('error', 'Room is full');
            return;
        }

        if (room.players.find(p => p.name === data.playerName)) {
            socket.emit('error', 'Name already taken');
            return;
        }

        const joinedMidGame = room.gameActive && room.settings.allowMidGameJoining;
        const joinSuccess = room.addPlayer(data.playerName, data.playerName, socket.id);
        if (!joinSuccess) {
            if (room.gameActive && !room.settings.allowMidGameJoining) {
                socket.emit('error', 'Game in progress - joining disabled');
            } else {
                socket.emit('error', 'Unable to join room');
            }
            return;
        }
        playerSockets.set(socket.id, { playerId: data.playerName, roomId: data.roomCode });
        
        socket.join(data.roomCode);
        
        socket.to(data.roomCode).emit('playerJoined', {
            players: room.players,
            newPlayerName: data.playerName,
            joinedMidGame: joinedMidGame
        });

        socket.emit('roomJoined', {
            roomCode: data.roomCode,
            roomName: room.name,
            players: room.players
        });

        io.to(data.roomCode).emit('playerUpdate', {
            players: room.players,
            message: `${data.playerName} joined`
        });
    });

    socket.on('cheatModeActivated', (data) => {
        if (data && data.roomCode && data.playerName) {
            logger.info(`CHEAT MODE: ${data.playerName} activated cheat mode in room ${data.roomCode}.`);
        }
    });

    socket.on('startGame', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === playerData.playerId);
        if (!player || !player.isHost) return;

        if (room.startGame()) {
            io.to(room.id).emit('gameStarted', {
                gameState: room.gameState,
                players: room.players
            });
            
            io.to(room.id).emit('gameMessage', {
                message: `Hand #${room.gameState.round} - Pre-flop: Call $1 or fold`,
                type: 'system'
            });
        }
    });

    socket.on('playerAction', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomId);
        if (!room || !room.gameActive) return;
                
        const result = room.processAction(playerData.playerId, data.action, data.amount);
        
        if (result) {
            io.to(room.id).emit('actionResult', result);
            
            io.to(room.id).emit('gameUpdate', {
                gameState: room.gameState,
                players: room.players
            });

            if (result.handComplete) {
                io.to(room.id).emit('handComplete', result.handComplete);
            } else if (result.newPhase) {
                // Announce turn for new phase after game state is updated
                const activePlayer = room.players[room.gameState.activePlayerIndex];
                if (activePlayer) {
                    logger.info(`GAME: Now ${activePlayer.name}'s turn.`);
                }
            }
        } else {
            logger.error(`ERROR: Action rejected for ${playerData.playerId}.`);
        }
    });



    socket.on('autoDealNext', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomId);
        if (!room || !room.autoDealing) return;
        
        room.autoDealing = false;
        room.newHand();
        
        io.to(room.id).emit('gameStarted', {
            gameState: room.gameState,
            players: room.players,
            overallDebt: room.getDebtSummary(),
            directDebts: room.getDirectDebtRelationships()
        });
        
        io.to(room.id).emit('gameMessage', {
            message: `Hand #${room.gameState.round} - Auto-dealt!`,
            type: 'system'
        });
    });

    socket.on('newHand', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === playerData.playerId);
        if (!player || !player.isHost) return;
        
        room.newHand();
        
        io.to(room.id).emit('gameStarted', {
            gameState: room.gameState,
            players: room.players,
            overallDebt: room.getDebtSummary(),
            directDebts: room.getDirectDebtRelationships()
        });
        
        io.to(room.id).emit('gameMessage', {
            message: `Hand #${room.gameState.round} - Manual deal`,
            type: 'system'
        });
    });

    socket.on('cheatSetCards', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomId);
        if (!room) return;
        
        const player = room.players.find(p => p.id === playerData.playerId);
        if (player && data.cards) {
            player.cards = data.cards;
            socket.emit('gameUpdate', {
                gameState: room.gameState,
                players: room.players
            });
        }
    });

    socket.on('disconnect', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomId);
        if (!room) return;
        
        const playerName = playerData.playerId; // Define playerName here
        const newHost = room.removePlayer(playerData.playerId);
        playerSockets.delete(socket.id);
        
        socket.to(playerData.roomId).emit('playerLeft', {
            players: room.players,
            gameState: room.gameState,
            playerName: playerName
        });

        if (room.players.length === 0) {
            room.logRoomDisbanding();
            rooms.delete(playerData.roomId);
        } else if (room.players.length < 2) {
            // Less than 2 players - send everyone back to main menu
            io.to(playerData.roomId).emit('notEnoughPlayers', {
                message: 'Not enough players - returning to main menu'
            });
            room.logRoomDisbanding();
            rooms.delete(playerData.roomId);
        } else {
            io.to(playerData.roomId).emit('playerUpdate', {
                players: room.players,
                message: `${playerData.playerId} left the game`
            });
        }
    });

    // Debt transfer functionality
    socket.on('transferDebt', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomId);
        if (!room) return;
        
        const { fromPlayerId, toPlayerId, creditorId, amount } = data;
        
        // Validate the transfer
        if (!fromPlayerId || !toPlayerId || !creditorId || !amount || amount <= 0) {
            socket.emit('debtTransferResult', { 
                success: false, 
                message: 'Invalid transfer parameters' 
            });
            return;
        }
        
        // Only allow players to transfer their own debts unless they're the host
        const isHost = room.players.find(p => p.id === playerData.playerId)?.isHost;
        if (!isHost && fromPlayerId !== playerData.playerId) {
            socket.emit('debtTransferResult', { 
                success: false, 
                message: 'You can only transfer your own debts' 
            });
            return;
        }
        
        // Perform the transfer
        const success = room.transferDebt(fromPlayerId, toPlayerId, creditorId, amount);
        
        if (success) {
            // Notify all players of the updated debt status
            io.to(room.id).emit('debtUpdate', {
                overallDebt: room.getDebtSummary(),
                directDebts: room.getDirectDebtRelationships(),
                message: `Debt transferred: $${amount} from ${fromPlayerId} to ${toPlayerId}`
            });
            
            socket.emit('debtTransferResult', { 
                success: true, 
                message: 'Debt transferred successfully' 
            });
        } else {
            socket.emit('debtTransferResult', { 
                success: false, 
                message: 'Transfer failed - insufficient debt or invalid players' 
            });
        }
    });

    socket.on('settleDebt', (data) => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;
        
        const room = rooms.get(playerData.roomId);
        if (!room) return;
        
        const { debtorId, creditorId, amount } = data;
        
        // Validate the settlement
        if (!debtorId || !creditorId || !amount || amount <= 0) {
            socket.emit('debtSettlementResult', { 
                success: false, 
                message: 'Invalid settlement parameters' 
            });
            return;
        }
        
        // Only allow players to settle their own debts or if they're the host
        const isHost = room.players.find(p => p.id === playerData.playerId)?.isHost;
        if (!isHost && debtorId !== playerData.playerId && creditorId !== playerData.playerId) {
            socket.emit('debtSettlementResult', { 
                success: false, 
                message: 'You can only settle debts you are involved in' 
            });
            return;
        }
        
        // Perform the settlement
        const success = room.settleDebt(debtorId, creditorId, amount);
        
        if (success) {
            // Notify all players of the updated debt status
            io.to(room.id).emit('debtUpdate', {
                overallDebt: room.getDebtSummary(),
                directDebts: room.getDirectDebtRelationships(),
                message: `Debt settled: $${amount} between ${debtorId} and ${creditorId}`
            });
            
            socket.emit('debtSettlementResult', { 
                success: true, 
                message: 'Debt settled successfully' 
            });
        } else {
            socket.emit('debtSettlementResult', { 
                success: false, 
                message: 'Settlement failed - debt not found or insufficient amount' 
            });
        }
    });
});

app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
})

const PORT = process.env.PORT || 80;
server.listen(PORT, '0.0.0.0', () => {
    // Log session start
    pokerLog.header(`🚀 NEW POKER SESSION`);
    console.log(`\x1b[42m\x1b[30m\x1b[1m 📅 Session started at ${new Date().toLocaleString()} \x1b[0m`);
    console.log('');
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
    console.log('\n');
    pokerLog.header(`🛑 SERVER SHUTDOWN`);
    console.log(`\x1b[41m\x1b[37m\x1b[1m ⏹️  Session ended at ${new Date().toLocaleString()} \x1b[0m`);
    
    // Log any remaining active rooms
    if (rooms.size > 0) {
        console.log(`\x1b[33m\x1b[1m 🏠 Disbanding ${rooms.size} active room(s)... \x1b[0m`);
        rooms.forEach(room => {
            room.logRoomDisbanding();
        });
    }
    
    rl.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n');
    pokerLog.header(`🛑 SERVER SHUTDOWN`);
    console.log(`\x1b[41m\x1b[37m\x1b[1m ⏹️  Session ended at ${new Date().toLocaleString()} \x1b[0m`);
    
    // Log any remaining active rooms
    if (rooms.size > 0) {
        console.log(`\x1b[33m\x1b[1m 🏠 Disbanding ${rooms.size} active room(s)... \x1b[0m`);
        rooms.forEach(room => {
            room.logRoomDisbanding();
        });
    }
    
    pokerLog.divider();
    logger.info(`Server shutdown - Session ended`);
    rl.close();
    process.exit(0);
});
