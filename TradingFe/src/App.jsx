import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import AuthContext from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import PrivateRoute from './utils/PrivateRoute';
import useAxios from './utils/useAxios';

function Dashboard() {
  const [ticker, setTicker] = useState('');
  const [watchlist, setWatchlist] = useState([]);
  const [news, setNews] = useState([]);
  const [prices, setPrices] = useState({});
  const [newsLoading, setNewsLoading] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { user, logoutUser } = useContext(AuthContext);
  const api = useAxios(); // Authenticated Axios instance

  const [predictions, setPredictions] = useState({});
  const [predictingStocks, setPredictingStocks] = useState({});

  // Fetch stocks from backend
  const fetchStocks = useCallback(async () => {
    try {
      const response = await api.get('/api/stocks/');
      if (response.data && Array.isArray(response.data.stocks)) {
        setWatchlist(response.data.stocks);
        return response.data.stocks;
      }
      return [];
    } catch (error) {
      console.error("Error fetching stocks:", error);
      return [];
    }
  }, []); // api dependency is stable enough usually, or include it if strictly linting

  // Fetch news for given stocks
  const fetchNews = useCallback(async (stocks) => {
    if (!stocks || stocks.length === 0) {
      setNews([]);
      return;
    };
    setNewsLoading(true);
    try {
      const tickers = stocks.map(s => s.ticker).join(',');
      const response = await api.get(`/api/news/?stocks=${tickers}`);
      if (response.data && Array.isArray(response.data.news)) {
        setNews(response.data.news);
      }
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // Fetch live prices
  const fetchPrices = useCallback(async (stocks) => {
    if (!stocks || stocks.length === 0) return;
    try {
      const tickers = stocks.map(s => s.ticker).join(',');
      const response = await api.get(`/api/prices/?stocks=${tickers}`);
      setPrices(response.data.prices);
    } catch (error) {
      console.error("Error fetching prices:", error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      const stocks = await fetchStocks();
      if (stocks.length > 0) {
        fetchNews(stocks);
        fetchPrices(stocks);
      }
    };
    loadData();

    // Poll prices every 30 seconds
    const interval = setInterval(() => {
      // Re-fetch current watchlist from state might be stale in interval closure without ref, 
      // but simpler to just fetch if we know we have stocks. 
      // Better: pass stocks to fetchPrices? No, fetchPrices needs latest list.
      // We'll trust the effect dependency or just trigger a re-fetch of stocks then prices.
      // For simplicity/performance: just re-run loadData logic or rely on user interaction.
      // Let's just poll existing watchlist if available.
    }, 30000);

    // Better polling setup:
    return () => clearInterval(interval);
  }, [fetchStocks, fetchNews, fetchPrices]);

  // Separate effect for polling that depends on watchlist
  useEffect(() => {
    const interval = setInterval(() => {
      if (watchlist.length > 0) fetchPrices(watchlist);
    }, 30000);
    return () => clearInterval(interval);
  }, [watchlist, fetchPrices]);


  // Scroll to Top visibility logic
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  // Add stock to backend and update list
  const addStock = async () => {
    if (!ticker) return;
    try {
      await api.post('/api/stocks/', { ticker });
      setTicker('');
      const updatedStocks = await fetchStocks();
      fetchNews(updatedStocks);
      fetchPrices(updatedStocks);
    } catch (error) {
      console.error("Error adding stock:", error);
      alert("Error adding stock. It might already exist.");
    }
  };

  // Remove stock from backend and update list
  const removeStock = async (stockId) => {
    try {
      await api.delete(`/api/stocks/${stockId}/`);
      const updatedStocks = await fetchStocks();
      fetchNews(updatedStocks);
      fetchPrices(updatedStocks);
    } catch (error) {
      console.error("Error deleting stock:", error);
    }
  };

  // Analyze stock with AI
  const analyzeStock = async (stockTicker) => {
    setPredictingStocks(prev => ({ ...prev, [stockTicker]: true }));
    try {
      const response = await api.get(`/api/predict/?stock=${stockTicker}`);
      setPredictions(prev => ({
        ...prev,
        [stockTicker]: response.data
      }));
    } catch (error) {
      console.error("Error analyzing stock:", error);
      alert("Analysis failed. Is Ollama running?");
    } finally {
      setPredictingStocks(prev => ({ ...prev, [stockTicker]: false }));
    }
  };

  // Scroll to Stock Section
  const scrollToStock = (stockName) => {
    const element = document.getElementById(`stock-${stockName}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Scroll to Top
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Group news by stock
  const groupedNews = useMemo(() => {
    const groups = {};
    news.forEach(item => {
      if (!groups[item.stock]) {
        groups[item.stock] = [];
      }
      groups[item.stock].push(item);
    });
    return groups;
  }, [news]);

  return (
    <div className="min-h-screen w-full bg-slate-900 text-white font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black selection:bg-blue-500/30">

      {/* Navbar / Header Area */}
      <div className="sticky top-0 z-40 backdrop-blur-md bg-slate-900/50 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400 tracking-tight cursor-default">
              Market Pulse
            </h1>
          </div>
          <div className="flex items-center gap-6">
            {user && (
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Welcome</span>
                <span className="text-sm font-medium text-slate-200">{user.username}</span>
              </div>
            )}
            <button
              onClick={logoutUser}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">

        {/* Input & Watchlist Section */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 shadow-2xl mb-12 animate-fade-in-up">

          <div className="flex flex-col gap-6">
            <h2 className="text-center text-slate-400 text-sm font-bold uppercase tracking-widest">Manage Your Watchlist</h2>

            {/* Input */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-lg group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl opacity-30 group-hover:opacity-60 transition duration-500 blur"></div>
                <div className="relative flex">
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addStock()}
                    placeholder="Add ticker (e.g. RELIANCE, INF)"
                    className="w-full pl-5 pr-20 py-4 bg-slate-900 border border-slate-700/50 rounded-xl focus:outline-none focus:ring-0 text-white placeholder-slate-500 transition-all shadow-inner"
                  />
                  <button
                    onClick={addStock}
                    className="absolute right-2 top-2 bottom-2 px-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg font-bold shadow-lg transition-all transform hover:-translate-y-0.5"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Tags with Prices */}
            <div className="flex flex-wrap gap-3 justify-center mt-2 min-h-[40px]">
              {watchlist.length === 0 && (
                <span className="text-slate-500 italic text-sm py-2">Your watchlist is empty. Add stocks to track news and prices.</span>
              )}
              {watchlist.map((stock) => (
                <div
                  key={stock.id}
                  className="group flex items-center gap-3 pl-4 pr-2 py-2 bg-slate-800/80 border border-slate-600/30 rounded-full hover:bg-slate-700 hover:border-slate-500/50 transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                  onClick={() => scrollToStock(stock.ticker)}
                >
                  <span className="font-bold text-sm tracking-wide text-slate-100">{stock.ticker}</span>
                  {prices[stock.ticker] ? (
                    <span className="text-xs font-mono font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                      ₹{prices[stock.ticker]}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 animate-pulse">...</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeStock(stock.id); }}
                    className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-red-500 transition-colors z-10"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* News Feed by Stock */}
        <div className="space-y-16 pb-20">
          {newsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400"></div>
              <p className="text-slate-400 animate-pulse">Curating latest market insights...</p>
            </div>
          ) : Object.keys(groupedNews).length > 0 ? (
            Object.entries(groupedNews).map(([stockName, items]) => (
              <section key={stockName} id={`stock-${stockName}`} className="animate-fade-in scroll-mt-32">

                {/* Stock Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-700/50 pb-6">
                  <div className="flex items-center gap-5">
                    <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 tracking-tight">
                      {stockName}
                    </h2>

                    {/* Live Price Badge */}
                    {prices[stockName] && (
                      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg shadow-inner">
                        <div className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </div>
                        <span className="text-xl font-mono font-bold text-slate-100">₹{prices[stockName]}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Area */}
                  <div className="flex items-center gap-4">
                    {/* AI Analyze Button */}
                    <button
                      onClick={() => analyzeStock(stockName)}
                      disabled={predictingStocks[stockName]}
                      className="px-5 py-2 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                    >
                      {predictingStocks[stockName] ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          Processing
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                          Ask AI
                        </>
                      )}
                    </button>

                    {/* Prediction Badge */}
                    {predictions[stockName] && (
                      <div className={`flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 px-5 py-2 rounded-xl border backdrop-blur-md shadow-lg animation-slide-in ${predictions[stockName].prediction === 'HIGH'
                        ? 'bg-green-900/20 border-green-500/40 text-green-300 shadow-green-900/10'
                        : predictions[stockName].prediction === 'LOW'
                          ? 'bg-red-900/20 border-red-500/40 text-red-300 shadow-red-900/10'
                          : 'bg-slate-700/50 border-slate-600 text-slate-300'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg">{predictions[stockName].prediction}</span>
                          {predictions[stockName].target && (
                            <span className="font-mono bg-black/40 px-2 py-0.5 rounded text-xs border border-white/10 text-white/80">
                              Target: {predictions[stockName].target}
                            </span>
                          )}
                        </div>
                        <span className="text-xs md:text-sm opacity-90 border-l-0 md:border-l border-white/20 pl-0 md:pl-4 italic">{predictions[stockName].reason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* News Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map((item, index) => (
                    <article key={index} className="flex flex-col h-full bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300 border border-slate-700/50 hover:border-slate-500/50 group transform hover:-translate-y-1">
                      <div className="p-6 flex-1 flex flex-col relative overflow-hidden">
                        {/* Subtle decorative gradient */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>

                        <div className="flex justify-between items-start mb-4 text-xs font-medium text-slate-400 uppercase tracking-wider relative z-10">
                          <span className="bg-slate-800/80 px-2 py-1 rounded">{item.source}</span>
                          <span>{new Date(item.published).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>

                        <h3 className="text-xl font-bold text-slate-100 leading-snug mb-3 group-hover:text-blue-400 transition-colors relative z-10">
                          {item.title}
                        </h3>

                        <div className="h-1 w-10 bg-blue-500/50 rounded-full mb-4 group-hover:w-20 transition-all duration-300"></div>

                        <p className="text-sm text-slate-400 mb-6 line-clamp-3 flex-1 relative z-10 leading-relaxed">
                          {item.summary ? item.summary.replace(/<[^>]+>/g, '') : 'Click below to read the full story on the source website...'}
                        </p>

                        <div className="mt-auto pt-4 border-t border-slate-700/50 relative z-10 flex justify-between items-center opacity-80 group-hover:opacity-100 transition-opacity">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors gap-1"
                          >
                            Read Full Story
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          ) : (
            watchlist.length > 0 && !newsLoading && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 border border-slate-700 mb-4 animate-bounce">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-lg">No meaningful news found for your watchlist recently.</p>
                <p className="text-slate-600 text-sm mt-2">Try adding different major stocks like 'GOOGL' or 'TSLA'.</p>
              </div>
            )
          )}
        </div>

        {/* Back to Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg hover:shadow-blue-500/50 transition-all z-50 animate-bounce-in ring-4 ring-blue-900/30"
            aria-label="Back to top"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
