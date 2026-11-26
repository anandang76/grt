import { api, put } from './api';

export const MAX_WATCHLIST = 10;

let instrumentsCache = null;

export async function getInstruments() {
  if (!instrumentsCache) instrumentsCache = await api('/instruments');
  return instrumentsCache;
}

// Drop the cached /instruments so the picker re-fetches (e.g. after the master list changes).
export const clearInstrumentsCache = () => { instrumentsCache = null; };

// Master list (admin): the full universe + current selection; saving prunes everyone to it.
export const getMasterList = () => api('/admin/master-list');
export const saveMasterList = (symbols) => put('/admin/master-list', { symbols });

export const getWatchlist = () => api('/watchlist');
export const fetchStoredCandles = (symbol, fresh = false) => api(`/candles/${encodeURIComponent(symbol)}${fresh ? '?fresh=1' : ''}`);
export const saveWatchlist = (symbols) => put('/watchlist', { symbols });
export const adminSaveWatchlist = (userId, symbols) => put(`/admin/users/${userId}/watchlist`, { symbols });

export const getDhanStatus = () => api('/broker/dhan');
export const saveDhanClientId = (client_id) => put('/broker/dhan/client-id', { client_id });
export const saveDhanToken = (token) => put('/broker/dhan/token', { token });
