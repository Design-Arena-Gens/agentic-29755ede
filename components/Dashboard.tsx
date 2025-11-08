'use client';

import React, { useState, useEffect } from 'react';
import { TradingBot, BotConfig, TradeHistory, BotStatus } from '@/lib/tradingBot';
import { MT5Config, MT5Position, MT5AccountInfo } from '@/lib/mt5Bridge';
import { TradeSignal } from '@/lib/aiEngine';
import { Play, Pause, Square, TrendingUp, TrendingDown, DollarSign, Activity, BarChart3, Brain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function Dashboard() {
  const [bot, setBot] = useState<TradingBot | null>(null);
  const [status, setStatus] = useState<BotStatus>('idle');
  const [accountInfo, setAccountInfo] = useState<MT5AccountInfo | null>(null);
  const [positions, setPositions] = useState<MT5Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [latestSignal, setLatestSignal] = useState<TradeSignal | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([]);
  const [showSetup, setShowSetup] = useState(true);

  // MT5 Configuration
  const [mt5Config, setMt5Config] = useState<MT5Config>({
    accountNumber: '',
    password: '',
    server: '',
    symbol: 'EURUSD'
  });

  // Bot Configuration
  const [botConfig] = useState<BotConfig>({
    symbol: 'EURUSD',
    maxPositions: 3,
    riskPerTrade: 0.02,
    minConfidence: 65,
    analysisInterval: 5000 // 5 seconds
  });

  const initializeBot = async () => {
    try {
      const newBot = new TradingBot(botConfig);

      newBot.onStatusChanged((newStatus) => {
        setStatus(newStatus);
      });

      newBot.onTrade((trade) => {
        setTradeHistory((prev) => [trade, ...prev]);
      });

      newBot.onAnalysis((signal) => {
        setLatestSignal(signal);
      });

      await newBot.connect(mt5Config);
      setBot(newBot);
      setShowSetup(false);
      setStatus('connected');
    } catch (error) {
      alert('Connection failed. Using demo mode.');
    }
  };

  useEffect(() => {
    if (!bot || status === 'idle') return;

    const interval = setInterval(async () => {
      if (bot) {
        const account = await bot.getAccountInfo();
        const pos = await bot.getPositions();
        const price = await bot.getCurrentPrice();

        setAccountInfo(account);
        setPositions(pos);
        setCurrentPrice(price);

        // Update price history
        setPriceHistory((prev) => {
          const newHistory = [...prev, {
            time: new Date().toLocaleTimeString(),
            price
          }];
          return newHistory.slice(-50);
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [bot, status]);

  const handleStart = async () => {
    if (bot) {
      await bot.start();
    }
  };

  const handlePause = () => {
    if (bot) {
      bot.pause();
    }
  };

  const handleStop = async () => {
    if (bot) {
      await bot.closeAllPositions();
      bot.stop();
    }
  };

  const calculateStats = () => {
    const closedTrades = tradeHistory.filter(t => t.action === 'CLOSE');
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0).length;
    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return { totalTrades, winningTrades, totalProfit, winRate };
  };

  const stats = calculateStats();

  if (showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-blue-500">
            <div className="flex items-center gap-4 mb-8">
              <Brain className="w-12 h-12 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">AI Forex Trading Bot</h1>
                <p className="text-gray-400">Connect to MetaTrader5</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={mt5Config.accountNumber}
                  onChange={(e) => setMt5Config({ ...mt5Config, accountNumber: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your MT5 account number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={mt5Config.password}
                  onChange={(e) => setMt5Config({ ...mt5Config, password: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your MT5 password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Server
                </label>
                <input
                  type="text"
                  value={mt5Config.server}
                  onChange={(e) => setMt5Config({ ...mt5Config, server: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ICMarkets-Demo01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Trading Symbol
                </label>
                <select
                  value={mt5Config.symbol}
                  onChange={(e) => setMt5Config({ ...mt5Config, symbol: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="EURUSD">EUR/USD</option>
                  <option value="GBPUSD">GBP/USD</option>
                  <option value="USDJPY">USD/JPY</option>
                  <option value="AUDUSD">AUD/USD</option>
                  <option value="USDCAD">USD/CAD</option>
                </select>
              </div>

              <button
                onClick={initializeBot}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                Connect to MT5
              </button>

              <div className="bg-blue-900 bg-opacity-30 border border-blue-500 rounded-lg p-4">
                <p className="text-sm text-blue-200">
                  <strong>Note:</strong> This is a demo interface. In production, you would need a backend server to securely connect to MetaTrader5 Terminal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6 border border-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Brain className="w-10 h-10 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">AI Forex Trading Bot</h1>
                <p className="text-gray-400">MetaTrader5 Connected • {mt5Config.symbol}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-lg font-semibold ${
                status === 'running' ? 'bg-green-500 text-white' :
                status === 'paused' ? 'bg-yellow-500 text-white' :
                status === 'connected' ? 'bg-blue-500 text-white' :
                'bg-gray-600 text-gray-300'
              }`}>
                {status.toUpperCase()}
              </div>

              {status === 'connected' || status === 'paused' ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all"
                >
                  <Play className="w-5 h-5" />
                  Start
                </button>
              ) : null}

              {status === 'running' ? (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-all"
                >
                  <Pause className="w-5 h-5" />
                  Pause
                </button>
              ) : null}

              {(status === 'running' || status === 'paused') && (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all"
                >
                  <Square className="w-5 h-5" />
                  Stop
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Account Info */}
        {accountInfo && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Balance</span>
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                ${accountInfo.balance.toFixed(2)}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Equity</span>
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                ${accountInfo.equity.toFixed(2)}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Profit/Loss</span>
                {accountInfo.profit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className={`text-2xl font-bold ${accountInfo.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${accountInfo.profit.toFixed(2)}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Free Margin</span>
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                ${accountInfo.freeMargin.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Trades</div>
            <div className="text-2xl font-bold text-white">{stats.totalTrades}</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-green-400">{stats.winRate.toFixed(1)}%</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Total Profit</div>
            <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${stats.totalProfit.toFixed(2)}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">Current Price</div>
            <div className="text-2xl font-bold text-white">{currentPrice.toFixed(5)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Price Chart */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Price Chart</h2>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={priceHistory}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPrice)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* AI Signal */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">AI Analysis</h2>
            </div>
            {latestSignal ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Signal:</span>
                  <span className={`text-2xl font-bold ${
                    latestSignal.action === 'BUY' ? 'text-green-400' :
                    latestSignal.action === 'SELL' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {latestSignal.action}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Confidence:</span>
                  <span className="text-white font-semibold">{latestSignal.confidence.toFixed(1)}%</span>
                </div>
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-300">{latestSignal.reasoning}</div>
                </div>
                {latestSignal.action !== 'HOLD' && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Stop Loss:</span>
                      <span className="text-red-400 font-semibold">{latestSignal.stopLoss.toFixed(5)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Take Profit:</span>
                      <span className="text-green-400 font-semibold">{latestSignal.takeProfit.toFixed(5)}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-8">
                Waiting for analysis...
              </div>
            )}
          </div>
        </div>

        {/* Open Positions */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Open Positions</h2>
          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Ticket</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Volume</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Open Price</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Current</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.ticket} className="border-b border-gray-700">
                      <td className="py-3 px-4 text-white">{pos.ticket}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          pos.type === 'BUY' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {pos.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white">{pos.volume}</td>
                      <td className="py-3 px-4 text-white">{pos.openPrice.toFixed(5)}</td>
                      <td className="py-3 px-4 text-white">{pos.currentPrice.toFixed(5)}</td>
                      <td className={`py-3 px-4 font-semibold ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${pos.profit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">No open positions</div>
          )}
        </div>

        {/* Trade History */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Trade History</h2>
          {tradeHistory.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tradeHistory.map((trade) => (
                <div key={`${trade.id}-${trade.timestamp}`} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        trade.action === 'BUY' ? 'bg-green-500 text-white' :
                        trade.action === 'SELL' ? 'bg-red-500 text-white' :
                        'bg-gray-500 text-white'
                      }`}>
                        {trade.action}
                      </span>
                      <span className="text-white font-semibold">{trade.symbol}</span>
                      <span className="text-gray-400 text-sm">{new Date(trade.timestamp).toLocaleString()}</span>
                    </div>
                    {trade.profit !== undefined && (
                      <span className={`font-bold ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${trade.profit.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-300">{trade.reasoning}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">No trade history yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
