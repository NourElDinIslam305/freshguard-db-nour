const queries = require('../db/queries');

function totals({ from, to }) {
  const row = queries.getSummary({ from, to });
  const wastePercent = row.production > 0 ? (row.waste / row.production) * 100 : 0;
  return {
    total_production: row.production,
    total_waste: row.waste,
    waste_percent: Number(wastePercent.toFixed(2)),
    costs: row.costs,
    revenue: row.revenue,
    net_profit: row.revenue - row.costs
  };
}

function dailyReport(date) {
  const production = queries.getDailyProduction(date);
  const waste = queries.getDailyWaste(date);
  const costs = queries.getDailyCosts(date);
  const revenue = queries.getDailyRevenue(date);
  return {
    date,
    total_production: production,
    total_waste: waste,
    waste_percent: production > 0 ? Number(((waste / production) * 100).toFixed(2)) : 0,
    costs,
    revenue,
    net_profit: revenue - costs
  };
}

function trends(days) {
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  const fromDate = from.toISOString().slice(0, 10);
  const daysByDate = new Map();
  for (const date of Array.from({ length: days }, (_, index) => {
    const day = new Date(from);
    day.setDate(from.getDate() + index);
    return day.toISOString().slice(0, 10);
  })) {
    daysByDate.set(date, { date, production: 0, waste: 0, profit: 0 });
  }
  for (const row of queries.getProductionTrend(fromDate)) {
    if (daysByDate.has(row.date)) daysByDate.get(row.date).production = row.production;
  }
  for (const row of queries.getWasteTrend(fromDate)) {
    if (daysByDate.has(row.date)) daysByDate.get(row.date).waste = row.waste;
  }
  for (const row of queries.getFinancialTrend(fromDate)) {
    if (daysByDate.has(row.date)) daysByDate.get(row.date).profit = row.profit;
  }
  return Array.from(daysByDate.values());
}

module.exports = { totals, dailyReport, trends };
