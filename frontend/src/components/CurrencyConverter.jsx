import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const PRESET_AMOUNTS = [100, 500, 1000, 5000, 10000];

export default function CurrencyConverter({ currencies = [], defaultFrom = 'USD', defaultTo = 'INR' }) {
  const [amount, setAmount] = useState('100');
  const [fromCurr, setFromCurr] = useState(defaultFrom);
  const [toCurr, setToCurr] = useState(defaultTo);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConvert = async (amtVal, f, t) => {
    const num = parseFloat(amtVal);
    if (isNaN(num) || num < 0) {
      setError('Please enter a valid non-negative number');
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.convert(num, f, t);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Conversion failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (amount.trim() !== '') {
        handleConvert(amount, fromCurr, toCurr);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [amount, fromCurr, toCurr]);

  const handleSwap = () => {
    const temp = fromCurr;
    setFromCurr(toCurr);
    setToCurr(temp);
  };

  const currencyList = currencies && currencies.length > 0 ? currencies : [
    { iso_code: 'USD', name: 'US Dollar', symbol: '$' },
    { iso_code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { iso_code: 'EUR', name: 'Euro', symbol: '€' },
    { iso_code: 'GBP', name: 'British Pound', symbol: '£' },
    { iso_code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    { iso_code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { iso_code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { iso_code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { iso_code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  ];

  return (
    <div className="converter-card">
      <div className="converter-header">
        <h3 className="converter-title">Currency Converter</h3>
        <span className="converter-tag">Reference Rate</span>
      </div>

      <div className="converter-presets">
        {PRESET_AMOUNTS.map((p) => (
          <button
            key={p}
            type="button"
            className={`preset-btn ${parseFloat(amount) === p ? 'active' : ''}`}
            onClick={() => setAmount(String(p))}
          >
            {p.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="converter-grid">
        <div className="input-group">
          <label className="input-label" htmlFor="amount-input">Amount</label>
          <input
            id="amount-input"
            type="number"
            min="0"
            step="any"
            className="converter-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="from-curr">From</label>
          <select
            id="from-curr"
            className="converter-select"
            value={fromCurr}
            onChange={(e) => setFromCurr(e.target.value)}
          >
            {currencyList.map((c) => (
              <option key={c.iso_code} value={c.iso_code}>
                {c.iso_code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="swap-btn"
          onClick={handleSwap}
          title="Swap currencies"
          aria-label="Swap currencies"
        >
          ⇄
        </button>

        <div className="input-group">
          <label className="input-label" htmlFor="to-curr">To</label>
          <select
            id="to-curr"
            className="converter-select"
            value={toCurr}
            onChange={(e) => setToCurr(e.target.value)}
          >
            {currencyList.map((c) => (
              <option key={c.iso_code} value={c.iso_code}>
                {c.iso_code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="converter-error">{error}</div>}

      {result && !error && (
        <div className="conversion-result-box">
          <div className="result-main">
            <span className="result-amount">
              {Number(result.amount).toLocaleString()} {result.from} =
            </span>
            <span className="result-converted">
              {Number(result.converted_amount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} {result.to}
            </span>
          </div>

          <div className="result-meta">
            <span>Applied Reference Rate: 1 {result.from} = {Number(result.rate).toFixed(4)} {result.to}</span>
            {result.rate_date && <span> • Observation Date: {result.rate_date}</span>}
          </div>

          <div className="result-disclaimer">
            {result.disclaimer || 'Daily published reference rate; not an executable market quote.'}
          </div>
        </div>
      )}

      {loading && !result && (
        <div className="converter-loading">Calculating conversion...</div>
      )}
    </div>
  );
}

