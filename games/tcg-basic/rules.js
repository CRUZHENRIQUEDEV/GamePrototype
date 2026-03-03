// games/tcg-basic/rules.js
// Regras do TCG Básico — plugadas no CardEngine

export const rules = {
  startingHp:   20,
  maxMana:      10,
  drawPerTurn:   1,
  startingHandSize: 5,
  phases: ['draw', 'main', 'battle', 'end'],

  canAct(state, playerId, action) {
    if (state.turn !== playerId) return false;
    const player = state.players[playerId];

    if (action.type === 'play-card') {
      const card = player.hand.find(c => c.id === action.cardId || c.instanceId === action.cardId);
      if (!card) return false;
      if (player.mana < card.cost) return false;
      if (state.phase !== 'main') return false;
      return true;
    }

    if (action.type === 'attack') {
      if (state.phase !== 'battle') return false;
      const attacker = player.field.find(c => c.instanceId === action.attackerId);
      if (!attacker || attacker.tapped) return false;
      return true;
    }

    if (action.type === 'end-phase') return true;
    if (action.type === 'end-turn')  return true;

    return false;
  },

  resolveAction(state, action, playerId) {
    const player    = state.players[playerId];
    const opponent  = state.players[Object.keys(state.players).find(id => id !== playerId)];
    const mutations = [];

    if (action.type === 'play-card') {
      const card = player.hand.find(c => c.id === action.cardId || c.instanceId === action.cardId);
      mutations.push({ type: 'hand-remove', target: playerId,   value: card.instanceId ?? card.id });
      mutations.push({ type: 'field-add',   target: playerId,   value: { ...card, tapped: false, summoningSick: true } });
      mutations.push({ type: 'mana',        target: playerId,   value: -card.cost });

      // Efeitos de entrada
      if (card.effect?.startsWith('enter:damage:opponent:')) {
        const dmg = parseInt(card.effect.split(':')[3]);
        mutations.push({ type: 'damage', target: opponent.id, value: dmg });
      }
      if (card.effect === 'instant:damage:target:4' && action.targetId) {
        mutations.push({ type: 'damage', target: action.targetId, value: 4 });
      }
      if (card.effect === 'heal:self:4') {
        mutations.push({ type: 'heal', target: playerId, value: 4 });
      }
      if (card.effect === 'mana:temp:3') {
        mutations.push({ type: 'mana', target: playerId, value: 3 });
      }
    }

    if (action.type === 'attack') {
      const attacker = player.field.find(c => c.instanceId === action.attackerId);
      if (!attacker) return { mutations: [] };
      mutations.push({ type: 'field-remove', target: playerId, value: attacker.instanceId });
      mutations.push({ type: 'field-add',    target: playerId, value: { ...attacker, tapped: true } });

      if (action.targetId === opponent.id) {
        mutations.push({ type: 'damage', target: opponent.id, value: attacker.power });
      } else {
        // Ataque à criatura
        const blocker = opponent.field.find(c => c.instanceId === action.targetId);
        if (blocker) {
          if (attacker.power >= blocker.toughness)
            mutations.push({ type: 'graveyard', target: opponent.id, value: blocker.instanceId });
          if (blocker.power >= attacker.toughness)
            mutations.push({ type: 'graveyard', target: playerId, value: attacker.instanceId });
        }
      }
    }

    return { mutations };
  },
};
