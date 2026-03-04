// games/checkers/CheckersEngine.js
// Motor de dama — lógica pura, sem DOM

export class CheckersEngine {
  initGame() {
    const board = this._emptyBoard();

    // Peças vermelhas: linhas 0-2, casas escuras
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) board[r][c] = { color: "red", isKing: false };

    // Peças brancas: linhas 5-7, casas escuras
    for (let r = 5; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) board[r][c] = { color: "white", isKing: false };

    this.state = {
      board,
      turn: "red",
      selected: null,
      validMoves: [],
      mustCaptureFrom: null, // { row, col } durante capturas encadeadas
      pieceCount: { red: 12, white: 12 },
      phase: "playing",
      winner: null,
    };
    return this.state;
  }

  // ── Seleção ─────────────────────────────────────────────────────────────

  selectPiece(row, col) {
    const { board, turn, mustCaptureFrom } = this.state;
    const piece = board[row][col];
    if (!piece || piece.color !== turn) return false;
    if (
      mustCaptureFrom &&
      (mustCaptureFrom.row !== row || mustCaptureFrom.col !== col)
    )
      return false;

    const moves = this._getMovesForPiece(row, col);
    if (moves.length === 0) return false;

    this.state.selected = { row, col };
    this.state.validMoves = moves;
    return true;
  }

  deselect() {
    this.state.selected = null;
    this.state.validMoves = [];
  }

  // ── Movimento local (já validado por selectPiece) ───────────────────────

  move(toRow, toCol) {
    const { selected, validMoves } = this.state;
    if (!selected) return null;
    const move = validMoves.find((m) => m.row === toRow && m.col === toCol);
    if (!move) return null;
    return this._doMove(
      selected.row,
      selected.col,
      toRow,
      toCol,
      move.captures
    );
  }

  // ── Movimento remoto (confiado, sem re-validação de turno) ──────────────

  applyRemoteMove(fromRow, fromCol, toRow, toCol) {
    const { board } = this.state;
    const piece = board[fromRow][fromCol];
    if (!piece) return null;
    const captures =
      this._getCaptures(fromRow, fromCol, piece, board).find(
        (m) => m.row === toRow && m.col === toCol
      )?.captures ?? [];
    return this._doMove(fromRow, fromCol, toRow, toCol, captures);
  }

  // ── Consultas públicas ──────────────────────────────────────────────────

  hasForcedCapture() {
    return this._anyForcedCapture(this.state.turn, this.state.board);
  }

  /** Retorna lista de {row,col} de peças que têm captura obrigatória */
  getForcedPieces() {
    const { board, turn } = this.state;
    const list = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (
          board[r][c]?.color === turn &&
          this._getCaptures(r, c, board[r][c], board).length > 0
        )
          list.push({ row: r, col: c });
    return list;
  }

  // ── Bot AI ──────────────────────────────────────────────────────────────

  getBotMove(color) {
    const { board } = this.state;
    let candidatePieces = [];

    // 1. Check for forced captures
    const forced = this.getForcedPieces();
    if (forced.length > 0) {
      candidatePieces = forced;
    } else {
      // 2. Get all pieces with valid moves
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.color === color) {
            // Check if this piece has any moves
            if (this._getMovesForPiece(r, c).length > 0) {
              candidatePieces.push({ row: r, col: c });
            }
          }
        }
      }
    }

    if (candidatePieces.length === 0) return null;

    // 3. Pick a random piece
    const piece =
      candidatePieces[Math.floor(Math.random() * candidatePieces.length)];

    // 4. Get moves for that piece
    const moves = this._getMovesForPiece(piece.row, piece.col);

    // Filter moves: if forced capture exists, only consider captures
    const validMoves = moves.filter((m) => {
      if (forced.length > 0) {
        return m.captures && m.captures.length > 0;
      }
      return true;
    });

    if (validMoves.length === 0) return null;

    const move = validMoves[Math.floor(Math.random() * validMoves.length)];

    return {
      from: piece,
      to: { row: move.row, col: move.col },
    };
  }

  // ── Internos ────────────────────────────────────────────────────────────

  _doMove(fr, fc, tr, tc, captures) {
    const { board } = this.state;
    const piece = { ...board[fr][fc] };
    board[tr][tc] = piece;
    board[fr][fc] = null;

    const captured = [];
    captures.forEach(({ row, col }) => {
      if (board[row][col]) {
        captured.push({ row, col, color: board[row][col].color });
        this.state.pieceCount[board[row][col].color]--;
        board[row][col] = null;
      }
    });

    // Promoção a dama
    let promoted = false;
    if (!piece.isKing) {
      if (
        (piece.color === "red" && tr === 7) ||
        (piece.color === "white" && tr === 0)
      ) {
        board[tr][tc].isKing = true;
        promoted = true;
      }
    }

    this.state.selected = null;
    this.state.validMoves = [];

    // Captura encadeada (só se não acabou de ser promovida)
    if (captures.length > 0 && !promoted) {
      const chain = this._getCaptures(tr, tc, board[tr][tc], board);
      if (chain.length > 0) {
        this.state.mustCaptureFrom = { row: tr, col: tc };
        return {
          success: true,
          chainCapture: true,
          captured,
          promoted,
          chainPos: { row: tr, col: tc },
        };
      }
    }

    this.state.mustCaptureFrom = null;
    const opponent = piece.color === "red" ? "white" : "red";

    if (this.state.pieceCount[opponent] === 0 || !this._hasAnyMove(opponent)) {
      this.state.phase = "gameover";
      this.state.winner = piece.color;
      return { success: true, winner: piece.color, captured, promoted };
    }

    this.state.turn = opponent;
    return { success: true, captured, promoted };
  }

  _getMovesForPiece(row, col) {
    const { board, turn } = this.state;
    const piece = board[row][col];
    const captures = this._getCaptures(row, col, piece, board);
    const simple = this._getSimpleMoves(row, col, piece, board);
    return [...captures, ...simple];
  }

  _getSimpleMoves(row, col, piece, board) {
    const dirs = piece.isKing
      ? [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]
      : piece.color === "red"
      ? [
          [1, -1],
          [1, 1],
        ]
      : [
          [-1, -1],
          [-1, 1],
        ];
    return dirs
      .map(([dr, dc]) => ({ row: row + dr, col: col + dc, captures: [] }))
      .filter(({ row: r, col: c }) => this._inBounds(r, c) && !board[r][c]);
  }

  // Capturas em todas as 4 diagonais (incluindo para trás) — regra dama brasileira
  _getCaptures(row, col, piece, board) {
    const moves = [];
    for (const [dr, dc] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      const mr = row + dr,
        mc = col + dc; // casa do inimigo
      const nr = row + dr * 2,
        nc = col + dc * 2; // destino
      if (
        this._inBounds(nr, nc) &&
        board[mr]?.[mc]?.color &&
        board[mr][mc].color !== piece.color &&
        !board[nr][nc]
      ) {
        moves.push({ row: nr, col: nc, captures: [{ row: mr, col: mc }] });
      }
    }
    return moves;
  }

  _anyForcedCapture(color, board) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (
          board[r][c]?.color === color &&
          this._getCaptures(r, c, board[r][c], board).length > 0
        )
          return true;
    return false;
  }

  _hasAnyMove(color) {
    const { board } = this.state;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c]?.color === color) {
          if (this._getCaptures(r, c, board[r][c], board).length > 0)
            return true;
          if (this._getSimpleMoves(r, c, board[r][c], board).length > 0)
            return true;
        }
    return false;
  }

  _inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }
  _emptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(null));
  }
}
