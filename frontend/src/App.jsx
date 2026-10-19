import React, { useState, useEffect, useCallback } from 'react';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import ConverterPage from './pages/ConverterPage';
import HistoryPage from './pages/HistoryPage';
import ForecastsPage from './pages/ForecastsPage';
import MethodologyPage from './pages/MethodologyPage';
import StatusNotice from './components/StatusNotice';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState(null);

  // App data states
  const [currencies, setCurrencies] = useState([]);
  const [latestRate, setLatestRate] = useState(null);
  const [historyRates, setHistoryRates] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [nowcast, setNowcast] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [dataStatus, setDataStatus] = useState('fresh');

  // Load primary data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // 1. Core data fetch in parallel
      const [currRes, latestRes, histRes, analyticsRes, nowcastRes, fcRes, evalRes] = await Promise.allSettled([
        api.getCurrencies(),
        api.getLatestRate('USD', 'INR', isRefresh),
        api.getHistory('USD', 'INR'),
        api.getAnalytics(30),
        api.getNowcast(),
        api.getForecast('1,3,5'),
        api.getEvaluation(false),
      ]);

      if (currRes.status === 'fulfilled' && currRes.value?.currencies) {
        setCurrencies(currRes.value.currencies);
      }

      if (latestRes.status === 'fulfilled' && latestRes.value) {
        setLatestRate(latestRes.value);
        if (latestRes.value.data_status) {
          setDataStatus(latestRes.value.data_status);
        }
      }

      if (histRes.status === 'fulfilled' && histRes.value?.rates) {
        setHistoryRates(histRes.value.rates);
      }

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
        setAnalytics(analyticsRes.value);
      }

      if (nowcastRes.status === 'fulfilled' && nowcastRes.value) {
        setNowcast(nowcastRes.value);
      }

      if (fcRes.status === 'fulfilled' && fcRes.value) {
        setForecast(fcRes.value);
      }

      if (evalRes.status === 'fulfilled' && evalRes.value) {
        setEvaluation(evalRes.value);
      }

      // Check for critical failures
      if (latestRes.status === 'rejected' && histRes.status === 'rejected') {
        throw new Error(latestRes.reason?.message || 'Failed to connect to CurLens API service');
      }
    } catch (err) {
      setError(err.message || 'Error loading currency analytics data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  const handleRecalculateEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const newEval = await api.getEvaluation(true);
      setEvaluation(newEval);
    } catch (err) {
      console.error('Failed to recompute evaluation:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      dataStatus={dataStatus}
      lastFetched={latestRate?.fetched_at}
      lastObsDate={latestRate?.date}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      {loading && (
        <div className="page-loading-state">
          <div className="spinner" />
          <p>Connecting to CurLens API and loading reference rate data...</p>
        </div>
      )}

      {error && !loading && historyRates.length === 0 && (
        <StatusNotice
          type="error"
          message="API Connection Error"
          details={error}
          onRetry={() => loadData(false)}
        />
      )}

      {!loading && (
        <>
          {activeTab === 'dashboard' && (
            <Dashboard
              latestRate={latestRate}
              analytics={analytics}
              nowcast={nowcast}
              historyRates={historyRates}
              currencies={currencies}
              dataStatus={dataStatus}
              error={error}
              onNavigate={setActiveTab}
              onRetry={handleRefresh}
            />
          )}

          {activeTab === 'converter' && (
            <ConverterPage currencies={currencies} />
          )}

          {activeTab === 'history' && (
            <HistoryPage
              historyRates={historyRates}
              analytics={analytics}
            />
          )}

          {activeTab === 'forecasts' && (
            <ForecastsPage
              nowcast={nowcast}
              forecast={forecast}
              evaluation={evaluation}
              historyRates={historyRates}
              onRecalculateEvaluation={handleRecalculateEvaluation}
              evaluating={isEvaluating}
            />
          )}

          {activeTab === 'methodology' && (
            <MethodologyPage />
          )}
        </>
      )}
    </AppShell>
  );
}
