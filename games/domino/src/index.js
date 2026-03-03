import { DominoGame } from './DominoGame.js';
import { DominoUI } from './DominoUI.js';

document.addEventListener('DOMContentLoaded', () => {
    const game = new DominoGame();
    const ui = new DominoUI(game);
    
    // Expose for debugging if needed
    window.game = game;
    window.ui = ui;
    
    console.log('Domino Game Initialized (Modular Version)');
});
