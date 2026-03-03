// shared/storage/StorageManager.js
// Wrapper IndexedDB — persistência local de coleções, decks e saves

class StorageManager {
  constructor(dbName = 'GamePrototype', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  /**
   * Inicializa o banco. Deve ser chamado antes de qualquer operação.
   * @param {Array<{name:string, keyPath:string, indexes?:Array<{field:string,unique?:boolean}>}>} stores
   */
  async init(stores = []) {
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.dbName, this.version);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        stores.forEach(({ name, keyPath, indexes = [], autoIncrement = false }) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath, autoIncrement });
            indexes.forEach(({ field, unique = false }) =>
              store.createIndex(field, field, { unique })
            );
          }
        });
      };

      req.onsuccess = e => { this.db = e.target.result; res(this); };
      req.onerror = e => rej(e.target.error);
    });
  }

  /** Insere ou atualiza um registro */
  put(storeName, record) {
    return this._tx(storeName, 'readwrite', s => s.put(record));
  }

  /** Insere múltiplos registros em batch */
  async putMany(storeName, records) {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach(r => store.put(r));
    return new Promise((res, rej) => {
      tx.oncomplete = () => res(records.length);
      tx.onerror = () => rej(tx.error);
    });
  }

  /** Lê um registro pelo key */
  get(storeName, key) {
    return this._tx(storeName, 'readonly', s => s.get(key));
  }

  /** Retorna todos os registros */
  getAll(storeName) {
    return this._tx(storeName, 'readonly', s => s.getAll());
  }

  /** Remove um registro */
  delete(storeName, key) {
    return this._tx(storeName, 'readwrite', s => s.delete(key));
  }

  /** Limpa todos os registros de uma store */
  clear(storeName) {
    return this._tx(storeName, 'readwrite', s => s.clear());
  }

  /** Conta registros */
  count(storeName) {
    return this._tx(storeName, 'readonly', s => s.count());
  }

  /** Busca por índice */
  query(storeName, indexName, value) {
    return this._tx(storeName, 'readonly', s => s.index(indexName).getAll(value));
  }

  /** Busca por range em índice */
  queryRange(storeName, indexName, lower, upper) {
    const range = IDBKeyRange.bound(lower, upper);
    return this._tx(storeName, 'readonly', s => s.index(indexName).getAll(range));
  }

  _tx(storeName, mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
}

export const storage = new StorageManager();
