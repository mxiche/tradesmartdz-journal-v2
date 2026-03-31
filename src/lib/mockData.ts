export const mockTrades = [
  { id: '1', symbol: 'NQ', direction: 'BUY', entry: 19850, exit_price: 19920, profit: 140, setup_tag: 'IFVG', duration: '23min', open_time: '2025-01-15T14:30:00Z', close_time: '2025-01-15T14:53:00Z', session: 'NY' },
  { id: '2', symbol: 'XAUUSD', direction: 'SELL', entry: 2318.5, exit_price: 2301.2, profit: 173, setup_tag: 'Liquidity Sweep', duration: '1h 12min', open_time: '2025-01-15T08:15:00Z', close_time: '2025-01-15T09:27:00Z', session: 'London' },
  { id: '3', symbol: 'NQ', direction: 'SELL', entry: 20100, exit_price: 20180, profit: -80, setup_tag: 'Order Block', duration: '8min', open_time: '2025-01-14T15:00:00Z', close_time: '2025-01-14T15:08:00Z', session: 'NY' },
  { id: '4', symbol: 'NQ', direction: 'BUY', entry: 19650, exit_price: 19700, profit: 50, setup_tag: 'FVG', duration: '45min', open_time: '2025-01-14T14:00:00Z', close_time: '2025-01-14T14:45:00Z', session: 'NY' },
  { id: '5', symbol: 'XAUUSD', direction: 'BUY', entry: 2285, exit_price: 2271, profit: -140, setup_tag: 'BOS/CHoCH', duration: '2h 5min', open_time: '2025-01-13T02:00:00Z', close_time: '2025-01-13T04:05:00Z', session: 'Asia' },
  { id: '6', symbol: 'NQ', direction: 'BUY', entry: 19920, exit_price: 19990, profit: 70, setup_tag: 'IFVG', duration: '31min', open_time: '2025-01-13T14:30:00Z', close_time: '2025-01-13T15:01:00Z', session: 'NY' },
  { id: '7', symbol: 'EURUSD', direction: 'SELL', entry: 1.0892, exit_price: 1.0845, profit: 47, setup_tag: 'FVG', duration: '3h 20min', open_time: '2025-01-12T08:00:00Z', close_time: '2025-01-12T11:20:00Z', session: 'London' },
  { id: '8', symbol: 'NQ', direction: 'SELL', entry: 20250, exit_price: 20190, profit: 60, setup_tag: 'Liquidity Sweep', duration: '17min', open_time: '2025-01-12T15:30:00Z', close_time: '2025-01-12T15:47:00Z', session: 'NY' },
  { id: '9', symbol: 'XAUUSD', direction: 'BUY', entry: 2301, exit_price: 2315, profit: 140, setup_tag: 'Order Block', duration: '55min', open_time: '2025-01-11T14:00:00Z', close_time: '2025-01-11T14:55:00Z', session: 'NY' },
  { id: '10', symbol: 'NQ', direction: 'BUY', entry: 19780, exit_price: 19740, profit: -40, setup_tag: 'FVG', duration: '12min', open_time: '2025-01-11T16:30:00Z', close_time: '2025-01-11T16:42:00Z', session: 'NY Lunch' },
];

export const mockStats = {
  winRate: 70,
  totalPnl: 420,
  profitFactor: 1.84,
  maxDrawdown: 3.2,
};

export const mockEquityCurve = [
  { date: 'Jan 11', balance: 10000 },
  { date: 'Jan 12', balance: 10100 },
  { date: 'Jan 13', balance: 10207 },
  { date: 'Jan 14', balance: 10077 },
  { date: 'Jan 15', balance: 10420 },
];

export const mockAccounts = [
  { id: '1', firm: 'FTMO', login: 12345678, account_name: 'Challenge Phase 1', balance: 100420, last_sync: '2025-01-15T15:00:00Z', todayPnl: 313 },
];

export const killZoneStats = [
  { session: 'london', winRate: 75, pnl: 220 },
  { session: 'newYork', winRate: 71, pnl: 240 },
  { session: 'asia', winRate: 0, pnl: -140 },
  { session: 'nyLunch', winRate: 0, pnl: -40 },
];

export const setupTags = ['FVG', 'IFVG', 'Liquidity Sweep', 'Order Block', 'BOS/CHoCH', 'Fair Value Gap + Sweep', 'Other'];
