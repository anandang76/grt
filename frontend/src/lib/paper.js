import { api, post } from './api';

export const getPositions = () => api('/paper/positions');
export const buyLeg = (payload) => post('/paper/positions', payload);
export const squareOff = (id, price) => post(`/paper/positions/${id}/squareoff`, { price });

// Best executable prices from a depth packet: you BUY at the ask, you SELL (square off) at the bid.
export const bestAsk = (d) => (d?.ask || []).find((a) => a.p > 0)?.p ?? (d?.ltp > 0 ? d.ltp : null);
export const bestBid = (d) => (d?.bid || []).find((b) => b.p > 0)?.p ?? (d?.ltp > 0 ? d.ltp : null);
