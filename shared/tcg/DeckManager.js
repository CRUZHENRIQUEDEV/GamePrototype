// shared/tcg/DeckManager.js
// Construção, validação e persistência de decks

import { storage } from '../storage/StorageManager.js';

export class DeckManager {
  /**
   * @param {Object} deckRules  { minSize, maxSize, maxCopies, ... }
   */
  constructor(deckRules = {}) {
    this.rules = {
      minSize:  20,
      maxSize:  60,
      maxCopies: 4,
      ...deckRules,
    };
  }

  /** Cria um deck novo */
  createDeck(name) {
    return {
      deckId: `deck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      cards: [],          // [{ id, quantity }]
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /** Adiciona carta ao deck (respeita maxCopies) */
  addCard(deck, cardId) {
    const entry = deck.cards.find(e => e.id === cardId);
    if (entry) {
      if (entry.quantity >= this.rules.maxCopies) return false;
      entry.quantity++;
    } else {
      deck.cards.push({ id: cardId, quantity: 1 });
    }
    deck.updatedAt = Date.now();
    return true;
  }

  /** Remove uma cópia da carta */
  removeCard(deck, cardId) {
    const entry = deck.cards.find(e => e.id === cardId);
    if (!entry) return false;
    entry.quantity--;
    if (entry.quantity <= 0) deck.cards = deck.cards.filter(e => e.id !== cardId);
    deck.updatedAt = Date.now();
    return true;
  }

  /** Conta total de cartas no deck */
  totalCards(deck) {
    return deck.cards.reduce((sum, e) => sum + e.quantity, 0);
  }

  /**
   * Valida o deck.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate(deck, cardDatabase = {}) {
    const errors = [];
    const total = this.totalCards(deck);

    if (total < this.rules.minSize)
      errors.push(`Mínimo de ${this.rules.minSize} cartas (tem ${total})`);
    if (total > this.rules.maxSize)
      errors.push(`Máximo de ${this.rules.maxSize} cartas (tem ${total})`);

    deck.cards.forEach(({ id, quantity }) => {
      if (quantity > this.rules.maxCopies)
        errors.push(`Máximo de ${this.rules.maxCopies} cópias de "${id}"`);
      if (Object.keys(cardDatabase).length && !cardDatabase[id])
        errors.push(`Carta desconhecida: "${id}"`);
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Expande o deck comprimido para array de instâncias de cartas.
   * @param {Object} deck
   * @param {Object} cardDatabase  { [id]: CardData }
   * @returns {Object[]}
   */
  expand(deck, cardDatabase) {
    const cards = [];
    deck.cards.forEach(({ id, quantity }) => {
      const base = cardDatabase[id];
      if (!base) return;
      for (let i = 0; i < quantity; i++) {
        cards.push({ ...base, instanceId: `${id}_${i}_${Date.now()}` });
      }
    });
    return cards;
  }

  // --- Persistência ---

  async saveDeck(deck) {
    deck.updatedAt = Date.now();
    await storage.put('decks', deck);
    return deck;
  }

  async loadDeck(deckId) {
    return storage.get('decks', deckId);
  }

  async loadAllDecks() {
    return storage.getAll('decks');
  }

  async deleteDeck(deckId) {
    return storage.delete('decks', deckId);
  }
}
