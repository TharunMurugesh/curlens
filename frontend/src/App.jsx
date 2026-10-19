import React, { useState, useEffect, useCallback } from 'react';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import ConverterPage from './pages/ConverterPage';
import HistoryPage from './pages/HistoryPage';
import ForecastsPage from './pages/ForecastsPage';
import MethodologyPage from './pages/MethodologyPage';
import StatusNotice from './components/StatusNotice';
import { api } from './services/api';

class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Section render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="section-error" role="alert">
          <h3>Unable to display this section</h3>
          <p>Something went wrong while displaying this view. Try again or refresh the page.</p>
          <button
            className="refresh-btn"
            onClick={() => this.props.onRetry()}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState(null);

  const [currencies, setCurrencies] = useState([]);
  const [latestRate, setLatestRate] = useState(null);
  const [historyRates, setHistoryRates] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [nowcast, setNowcast] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [dataStatus, setDataStatus] = useState('loading');
  const [sectionAttempt, setSectionAttempt] = useState(0);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
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
        setCurrencies(Array.isArray(currRes.value.currencies) ? currRes.value.currencies : []);
      }

      if (latestRes.status === 'fulfilled' && latestRes.value) {
        setLatestRate(latestRes.value);
        setDataStatus(latestRes.value.data_status || 'fresh');
      } else {
        setDataStatus('unavailable');
      }

      if (histRes.status === 'fulfilled' && histRes.value?.rates) {
        setHistoryRates(Array.isArray(histRes.value.rates) ? histRes.value.rates : []);
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

      if (latestRes.status === 'rejected' && histRes.status === 'rejected') {
        throw new Error(latestRes.reason?.message || 'Failed to connect to CurLens API service');
      }
    } catch (err) {
      setDataStatus('unavailable');
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
      {loading && !latestRate && historyRates.length === 0 && (
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

      {(!loading || latestRate || historyRates.length > 0) && (
        <TabErrorBoundary key={`${activeTab}-${sectionAttempt}`} onRetry={() => setSectionAttempt((attempt) => attempt + 1)}>
          {activeTab === 'dashboard' && (
            <Dashboard
              latestRate={latestRate}
              analytics={analytics}
              nowcast={nowcast}
              historyRates={historyRates}
              currencies={currencies}
              dataStatus={dataStatus}
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
        </TabErrorBoundary>
      )}
    </AppShell>
  );
}

