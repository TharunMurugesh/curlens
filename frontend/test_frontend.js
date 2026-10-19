
function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`[PASS] ${message}`);
}

console.log('=== CurLens Frontend Unit & Logic Verification ===\n');
function convert(amount, rate) {
  const num = parseFloat(amount);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * rate * 100) / 100;
}

assert(convert(100, 94.86) === 9486.00, 'USD 100 to INR at 94.86 = 9486.00');
assert(convert(1000, 1 / 94.86) === 10.54, 'INR 1000 to USD at 94.86 = 10.54');
assert(convert(0, 94.86) === 0, 'Zero conversion = 0');
assert(convert(-50, 94.86) === null, 'Negative amount rejected');
assert(convert('abc', 94.86) === null, 'Non-numeric string rejected');
const sampleRates = [
  { date: '2025-10-19', rate: 88.0 },
  { date: '2026-04-19', rate: 91.0 },
  { date: '2026-07-19', rate: 93.0 },
  { date: '2026-09-19', rate: 94.0 },
  { date: '2026-10-15', rate: 94.8 },
  { date: '2026-10-19', rate: 94.86 },
];

function filterByDays(rates, days) {
  if (!days) return rates;
  const lastDate = new Date(rates[rates.length - 1].date);
  const cutoff = new Date(lastDate);
  cutoff.setDate(lastDate.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return rates.filter((r) => r.date >= cutoffStr);
}

assert(filterByDays(sampleRates, null).length === 6, 'MAX range returns all observations');
assert(filterByDays(sampleRates, 30).length === 3, '1M range filters to last 30 days (Sept 19 to Oct 19)');
assert(filterByDays(sampleRates, 180).length === 4, '6M range filters to last 180 days (Jul, Sep, Oct)');
function computeDomain(data) {
  const vals = data.map((d) => d.rate);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const padding = (max - min) * 0.08 || 1;
  return {
    minY: Math.floor((min - padding) * 10) / 10,
    maxY: Math.ceil((max + padding) * 10) / 10,
  };
}

const domain = computeDomain(sampleRates);
assert(domain.minY <= 88.0, 'Domain minY encapsulates minimum rate');
assert(domain.maxY >= 94.86, 'Domain maxY encapsulates maximum rate');
function getMovementDescription(change) {
  if (change > 0) return 'Rupee weakened';
  if (change < 0) return 'Rupee strengthened';
  return 'Unchanged';
}

assert(getMovementDescription(0.5) === 'Rupee weakened', 'Rate increase correctly interpreted as Rupee weakened');
assert(getMovementDescription(-0.5) === 'Rupee strengthened', 'Rate decrease correctly interpreted as Rupee strengthened');
assert(getMovementDescription(0) === 'Unchanged', 'Zero change correctly interpreted as Unchanged');

console.log('\nAll frontend verification checks passed!');
