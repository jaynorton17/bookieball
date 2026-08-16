import { api } from './api';

export type TeamPerformanceData = {
  season: string;
  gw: string;
  profit: number;
  wins: number;
  losses: number;
  draws: number;
  totalSpins: number;
  rank: number;
};

export async function getTeamPerformanceHistory(teamId: number): Promise<TeamPerformanceData[]> {
  try {
    const response = await api.teamSeasonHistory(teamId);
    return response.seasons.map((entry) => ({
      season: entry.season,
      gw: '',
      profit: entry.profit ?? 0,
      wins: entry.wins ?? 0,
      losses: entry.losses ?? 0,
      draws: entry.draws ?? 0,
      totalSpins: entry.spins ?? 0,
      rank: entry.rank ?? 0,
    }));
  } catch (error) {
    console.error('Failed to fetch team performance history:', error);
    return [];
  }
}

export function calculateTeamTrends(history: TeamPerformanceData[]) {
  if (history.length < 2) return { profitTrend: 0, winRateTrend: 0 };
  
  const recent = history.slice(-5); // Last 5 gameweeks
  const older = history.slice(-10, -5); // Previous 5 gameweeks
  
  if (recent.length === 0 || older.length === 0) {
    return { profitTrend: 0, winRateTrend: 0 };
  }
  
  const recentAvgProfit = recent.reduce((sum, h) => sum + h.profit, 0) / recent.length;
  const olderAvgProfit = older.reduce((sum, h) => sum + h.profit, 0) / older.length;
  const profitTrend = ((recentAvgProfit - olderAvgProfit) / Math.abs(olderAvgProfit)) * 100 || 0;
  
  const recentWinRate = recent.reduce((sum, h) => sum + (h.wins / (h.wins + h.losses + h.draws) || 0), 0) / recent.length;
  const olderWinRate = older.reduce((sum, h) => sum + (h.wins / (h.wins + h.losses + h.draws) || 0), 0) / older.length;
  const winRateTrend = ((recentWinRate - olderWinRate) / Math.abs(olderWinRate)) * 100 || 0;
  
  return { profitTrend, winRateTrend };
}