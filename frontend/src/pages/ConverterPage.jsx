import React, { useState, useEffect } from 'react';
import CurrencyConverter from '../components/CurrencyConverter';
import { api } from '../services/api';

const POPULAR_PAIRS = [
  { from: 'USD', to: 'INR', label: 'US Dollar to Rupee' },
  { from: 'EUR', to: 'INR', label: 'Euro to Rupee' },
  { from: 'GBP', to: 'INR', label: 'British Pound to Rupee' },
  { from: 'AED', to: 'INR', label: 'UAE Dirham to Rupee' },
  { from: 'SGD', to: 'INR', label: 'Singapore Dollar to Rupee' },
  { from: 'CAD', to: 'INR', label: 'Canadian Dollar to Rupee' },
];

export default function ConverterPage({ currencies }) {
  const [popularRates, setPopularRates] = useState([]);
  const [loadingPairs, setLoadingPairs] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadPairs() {
      setLoadingPairs(true);
      const results = [];
      for (const pair of POPULAR_PAIRS) {
        try {
          const res = await api.getLatestRate(pair.from, pair.to);
          results.push({ ...pair, rate: res.rate, date: res.date });
        } catch (e) {
          // ignore or fallback
        }
      }
      if (isMounted) {
        setPopularRates(results);
        setLoadingPairs(false);
      }
    }
    loadPairs();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="converter-page">
      <div className="page-header">
        <h2 className="page-title">Currency Converter & Cross Rates</h2>
        <p className="page-description">
          Convert amounts using official daily reference rates published by central banks via the Frankfurter API.
        </p>
      </div>

      <div className="converter-page-grid">
        <div className="converter-main-col">
          <CurrencyConverter currencies={currencies} defaultFrom="USD" defaultTo="INR" />

          <div className="info-box">
            <h4>💡 Understanding Reference Rates</h4>
            <p>
              Reference exchange rates are indicative daily fixing rates established by central banks (such as the European Central Bank).
              Actual commercial foreign exchange transfers, bank cards, and payment processors typically add a margin or spread of 1% to 3.5% over the reference rate.
            </p>
          </div>
        </div>

        <div className="converter-table-col">
          <div className="table-card">
            <h3 className="table-title">Common Currency Pairs (INR)</h3>
            <span className="table-subtitle">Latest official reference exchange rates</span>

            {loadingPairs ? (
              <div className="table-loading">Loading exchange rates...</div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th>Rate</th>
                      <th>Obs Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popularRates.map((p) => (
                      <tr key={`${p.from}-${p.to}`}>
                        <td>
                          <strong>{p.from}/{p.to}</strong>
                          <div className="sub-label">{p.label}</div>
                        </td>
                        <td className="rate-col">₹{Number(p.rate).toFixed(4)}</td>
                        <td className="date-col">{p.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
