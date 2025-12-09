import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [ticker, setTicker] = useState('');
  const [watchlist, setWatchlist] = useState([]);
  const [news, setNews] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // API Config
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');

  const [showApiConfig, setShowApiConfig] = useState(false);

  // Predictions state: { "TCS": { prediction: "HIGH", target: "₹3200", reason: "..." } }
  const [predictions, setPredictions] = useState({});
  const [predictingStocks, setPredictingStocks] = useState({});

  // Fetch stocks from backend
  const fetchStocks = useCallback(async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/stocks/`);
      if (response.data && Array.isArray(response.data.stocks)) {
        setWatchlist(response.data.stocks);
        return response.data.stocks;
      }
      console.warn("Invalid stock data received (possibly tunnel auth page):", response.data);
      return [];
    } catch (error) {
      console.error("Error fetching stocks:", error);
      // If initial fetch fails, likely API issue -> Show Config
      if (watchlist.length === 0) setShowApiConfig(true);
      return [];
    }
  }, [apiUrl]);

  // Fetch news for given stocks
  const fetchNews = useCallback(async (stocks) => {
    if (!stocks || stocks.length === 0) {
      setNews([]);
      return;
    };
    setNewsLoading(true);
    try {
      const tickers = stocks.map(s => s.ticker).join(',');
      const response = await axios.get(`${apiUrl}/api/news/?stocks=${tickers}`);
      if (response.data && Array.isArray(response.data.news)) {
        setNews(response.data.news);
      }
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setNewsLoading(false);
    }
  }, [apiUrl]);

  // Fetch live prices
  const fetchPrices = useCallback(async (stocks) => {
    if (!stocks || stocks.length === 0) return;
    try {
      const tickers = stocks.map(s => s.ticker).join(',');
      const response = await axios.get(`${apiUrl}/api/prices/?stocks=${tickers}`);
      setPrices(response.data.prices);
    } catch (error) {
      console.error("Error fetching prices:", error);
    }
  }, [apiUrl]);

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
      if (watchlist.length > 0) fetchPrices(watchlist);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStocks, fetchNews, fetchPrices, watchlist.length]);

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
      await axios.post(`${apiUrl}/api/stocks/`, { ticker });
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
      await axios.delete(`${apiUrl}/api/stocks/${stockId}/`);
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
      const response = await axios.get(`${apiUrl}/api/predict/?stock=${stockTicker}`);
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
    <div className="min-h-screen w-full bg-slate-900 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 text-center relative">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400 tracking-tight">
            Market Pulse
          </h1>
          <p className="text-slate-400 mt-2">Live prices & AI insights</p>
          <button
            onClick={() => setShowApiConfig(!showApiConfig)}
            className="absolute right-0 top-0 p-2 text-slate-600 hover:text-slate-400"
          >
            ⚙️
          </button>
        </header>

        {/* API Config Modal */}
        {showApiConfig && (
          <div className="mb-8 p-4 bg-slate-800 border border-yellow-500/50 rounded-xl animate-fade-in">
            <h3 className="text-yellow-400 font-bold mb-2">📡 Backend Connection</h3>
            <p className="text-sm text-slate-300 mb-4">
              If you are using a public tunnel (like ngrok/localtunnel), enter the <b>Backend URL</b> here.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://your-backend-url.loca.lt"
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
              />
              <button
                onClick={() => { fetchStocks(); setShowApiConfig(false); }}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-bold"
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {/* Input & Watchlist Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl mb-12 sticky top-4 z-50">

          {/* Input */}
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-6">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addStock()}
                placeholder="Add ticker (e.g. RELIANCE, TCS)"
                className="w-full pl-4 pr-12 py-3 bg-slate-700/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-slate-400"
              />
              <button
                onClick={addStock}
                className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Tags with Prices */}
          <div className="flex flex-wrap gap-3 justify-center">
            {watchlist.map((stock) => (
              <div
                key={stock.id}
                className="group flex items-center gap-3 pl-4 pr-2 py-1.5 bg-slate-700/40 border border-slate-600/50 rounded-full hover:bg-slate-700 transition-colors cursor-pointer"
                onClick={() => scrollToStock(stock.ticker)}
              >
                <span className="font-semibold text-sm tracking-wide text-slate-200">{stock.ticker}</span>
                {prices[stock.ticker] && (
                  <span className="text-xs font-mono text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">
                    ₹{prices[stock.ticker]}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeStock(stock.id); }}
                  className="p-1 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors z-10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
            {watchlist.length === 0 && (
              <span className="text-slate-500 italic">No stocks in watchlist. Add to get started.</span>
            )}
          </div>
        </div>

        {/* News Feed by Stock */}
        <div className="space-y-12 pb-20">
          {newsLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
            </div>
          ) : Object.keys(groupedNews).length > 0 ? (
            Object.entries(groupedNews).map(([stockName, items]) => (
              <section key={stockName} id={`stock-${stockName}`} className="animate-fade-in scroll-mt-40">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-white tracking-wide border-l-4 border-blue-500 pl-4">
                      {stockName}
                    </h2>

                    {/* Live Price Badge */}
                    {prices[stockName] && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-lg font-mono font-medium text-slate-200">₹{prices[stockName]}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide ml-1">Live</span>
                      </div>
                    )}

                    {/* AI Analyze Button */}
                    <button
                      onClick={() => analyzeStock(stockName)}
                      disabled={predictingStocks[stockName]}
                      className="px-3 py-1 bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 rounded-full text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {predictingStocks[stockName] ? (
                        <>
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          ✨ AI Analysis
                        </>
                      )}
                    </button>
                  </div>

                  {/* Prediction Result Badge */}
                  {predictions[stockName] && (
                    <div className={`flex flex-wrap items-center gap-3 px-4 py-2 rounded-lg border ${predictions[stockName].prediction === 'HIGH'
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : predictions[stockName].prediction === 'LOW'
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-slate-700 border-slate-600 text-slate-300'
                      }`}>
                      <span className="font-bold">{predictions[stockName].prediction}</span>
                      {predictions[stockName].target && (
                        <span className="font-mono bg-black/20 px-2 py-0.5 rounded text-sm">
                          Target: {predictions[stockName].target}
                        </span>
                      )}
                      <span className="text-sm opacity-80 border-l border-white/10 pl-3">{predictions[stockName].reason}</span>
                    </div>
                  )}

                  <div className="h-px flex-1 bg-slate-800 hidden md:block"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map((item, index) => (
                    <article key={index} className="flex flex-col h-full bg-slate-800 rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-blue-900/10 transition-all duration-300 border border-slate-700 hover:border-slate-600 group">
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4 text-xs text-slate-400">
                          <span>{item.source}</span>
                          <span>{new Date(item.published).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-100 leading-snug mb-3 group-hover:text-blue-400 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-sm text-slate-400 mb-4 line-clamp-3 flex-1">
                          {item.summary ? item.summary.replace(/<[^>]+>/g, '') : 'Click to read more...'}
                        </p>
                        <div className="mt-auto pt-4 border-t border-slate-700/50">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Read article
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <div className="text-center py-20 text-slate-500">
                <p>No news found for your watchlist today.</p>
              </div>
            )
          )}
        </div>

        {/* Back to Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg hover:shadow-blue-500/30 transition-all z-50 animate-bounce-in"
            aria-label="Back to top"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
