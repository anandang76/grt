import { api, put } from './api';

export const MAX_WATCHLIST = 10;

let nifty50Cache = null;

export async function getNifty50() {
  if (!nifty50Cache) nifty50Cache = (await api('/nifty50')).symbols;
  return nifty50Cache;
}

export const getWatchlist = () => api('/watchlist');
export const saveWatchlist = (symbols) => put('/watchlist', { symbols });
export const adminSaveWatchlist = (userId, symbols) => put(`/admin/users/${userId}/watchlist`, { symbols });

export const getDhanStatus = () => api('/broker/dhan');
export const saveDhanToken = (token) => put('/broker/dhan', { token });
