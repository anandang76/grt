import { api, del, post } from './api';

export const getHistorySymbols = () => api('/admin/history/symbols');
export const getHistoryDays = (symbol) => api(`/admin/history/days/${encodeURIComponent(symbol)}`);
export const updateHistory = (symbol, dates) => post('/admin/history/update', { symbol, dates });
export const eraseHistory = (symbol) => del(`/admin/history/${encodeURIComponent(symbol)}`);
export const eraseAllHistory = (confirm) => post('/admin/history/erase-all', { confirm });
export const HISTORY_MAX_DAYS = 10;
