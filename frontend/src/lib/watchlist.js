import { api, put } from './api';

export const MAX_WATCHLIST = 10;

let instrumentsCache = null;

export async function getInstruments() {
  if (!instrumentsCache) instrumentsCache = await api('/instruments');
  return instrumentsCache;
}

export const getWatchlist = () => api('/watchlist');
export const saveWatchlist = (symbols) => put('/watchlist', { symbols });
export const adminSaveWatchlist = (userId, symbols) => put(`/admin/users/${userId}/watchlist`, { symbols });

export const getDhanStatus = () => api('/broker/dhan');
export const saveDhanClientId = (client_id) => put('/broker/dhan/client-id', { client_id });
export const saveDhanToken = (token) => put('/broker/dhan/token', { token });
