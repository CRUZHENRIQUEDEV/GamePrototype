// shared/core/AssetLoader.js
// Carregamento de assets com cache e progresso

import { bus } from './EventBus.js';

class AssetLoader {
  constructor() {
    this._cache = new Map();
    this._total = 0;
    this._loaded = 0;
  }

  /**
   * Carrega um manifesto de assets.
   * @param {Array<{key:string, url:string, type:'image'|'json'|'text'|'audio'}>} manifest
   * @returns {Promise<Object>} mapa key -> asset
   */
  async load(manifest) {
    this._total = manifest.length;
    this._loaded = 0;
    bus.emit('asset:load-start', { total: this._total });
    const results = await Promise.all(manifest.map(item => this._loadItem(item)));
    bus.emit('asset:load-complete', { total: this._total });
    return Object.fromEntries(results);
  }

  async _loadItem({ key, url, type }) {
    if (this._cache.has(key)) {
      this._loaded++;
      return [key, this._cache.get(key)];
    }
    let asset;
    try {
      if (type === 'image') asset = await this._loadImage(url);
      else if (type === 'json') asset = await fetch(url).then(r => r.json());
      else if (type === 'text') asset = await fetch(url).then(r => r.text());
      else if (type === 'audio') asset = await fetch(url).then(r => r.arrayBuffer());
      else asset = await fetch(url).then(r => r.blob());
    } catch (err) {
      console.warn(`[AssetLoader] Falha ao carregar "${key}" (${url}):`, err);
      asset = null;
    }
    this._cache.set(key, asset);
    this._loaded++;
    bus.emit('asset:progress', { loaded: this._loaded, total: this._total, key, progress: this._loaded / this._total });
    return [key, asset];
  }

  get(key) {
    return this._cache.get(key);
  }

  has(key) {
    return this._cache.has(key);
  }

  clear() {
    this._cache.clear();
  }

  _loadImage(url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });
  }
}

export const loader = new AssetLoader();
