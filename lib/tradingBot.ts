import { AITradingEngine, TradeSignal, MarketData } from './aiEngine';
import { MT5Bridge, MT5Config, MT5Position } from './mt5Bridge';

export interface BotConfig {
  symbol: string;
  maxPositions: number;
  riskPerTrade: number;
  minConfidence: number;
  analysisInterval: number; // milliseconds
}

export interface TradeHistory {
  id: number;
  timestamp: number;
  symbol: string;
  action: 'BUY' | 'SELL' | 'CLOSE';
  price: number;
  volume: number;
  profit?: number;
  reasoning: string;
}

export type BotStatus = 'idle' | 'connected' | 'running' | 'paused' | 'error';

export class TradingBot {
  private aiEngine: AITradingEngine;
  private mt5: MT5Bridge;
  private config: BotConfig;
  private status: BotStatus = 'idle';
  private tradeHistory: TradeHistory[] = [];
  private analysisInterval: NodeJS.Timeout | null = null;
  private onStatusChange?: (status: BotStatus) => void;
  private onTradeExecuted?: (trade: TradeHistory) => void;
  private onAnalysisComplete?: (signal: TradeSignal) => void;

  constructor(config: BotConfig) {
    this.config = config;
    this.aiEngine = new AITradingEngine();
    this.mt5 = new MT5Bridge();
  }

  async connect(mt5Config: MT5Config): Promise<void> {
    try {
      await this.mt5.connect(mt5Config);
      this.status = 'connected';
      this.notifyStatusChange();
    } catch (error) {
      this.status = 'error';
      this.notifyStatusChange();
      throw error;
    }
  }

  disconnect(): void {
    this.stop();
    this.mt5.disconnect();
    this.status = 'idle';
    this.notifyStatusChange();
  }

  async start(): Promise<void> {
    if (!this.mt5.isConnected()) {
      throw new Error('Not connected to MT5');
    }

    if (this.status === 'running') {
      return;
    }

    this.status = 'running';
    this.notifyStatusChange();

    // Start analysis loop
    this.analysisInterval = setInterval(async () => {
      await this.analyze();
    }, this.config.analysisInterval);

    // Run first analysis immediately
    await this.analyze();
  }

  stop(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    if (this.status === 'running') {
      this.status = 'paused';
      this.notifyStatusChange();
    }
  }

  pause(): void {
    this.stop();
  }

  resume(): void {
    if (this.status === 'paused') {
      this.start();
    }
  }

  private async analyze(): Promise<void> {
    if (this.status !== 'running') return;

    try {
      // Get market data
      const marketData = await this.mt5.getMarketData(this.config.symbol, 100);

      // Analyze with AI
      const signal = await this.aiEngine.analyzeMarket(marketData);

      // Notify listeners
      if (this.onAnalysisComplete) {
        this.onAnalysisComplete(signal);
      }

      // Execute trade if conditions are met
      if (signal.confidence >= this.config.minConfidence) {
        await this.executeTrade(signal, marketData);
      }

      // Manage existing positions
      await this.managePositions(marketData);

    } catch (error) {
      console.error('Analysis error:', error);
    }
  }

  private async executeTrade(signal: TradeSignal, marketData: MarketData[]): Promise<void> {
    try {
      // Check if we can open more positions
      const positions = await this.mt5.getPositions();
      if (positions.length >= this.config.maxPositions) {
        return;
      }

      // Don't open new positions if we should hold
      if (signal.action === 'HOLD') {
        return;
      }

      // Check if we already have a position in this direction
      const hasPosition = positions.some(p =>
        p.symbol === this.config.symbol && p.type === signal.action
      );

      if (hasPosition) {
        return;
      }

      // Open position
      const position = await this.mt5.openPosition(
        this.config.symbol,
        signal.action,
        signal.lotSize,
        signal.stopLoss,
        signal.takeProfit
      );

      // Record trade
      const trade: TradeHistory = {
        id: position.ticket,
        timestamp: Date.now(),
        symbol: this.config.symbol,
        action: signal.action,
        price: position.openPrice,
        volume: signal.lotSize,
        reasoning: signal.reasoning
      };

      this.tradeHistory.push(trade);

      if (this.onTradeExecuted) {
        this.onTradeExecuted(trade);
      }

    } catch (error) {
      console.error('Trade execution error:', error);
    }
  }

  private async managePositions(marketData: MarketData[]): Promise<void> {
    try {
      const positions = await this.mt5.getPositions();

      for (const position of positions) {
        // Check if position still exists (may have been closed by SL/TP)
        const currentPositions = await this.mt5.getPositions();
        const stillExists = currentPositions.some(p => p.ticket === position.ticket);

        if (!stillExists) {
          // Position was closed, record it
          const closeTrade: TradeHistory = {
            id: position.ticket,
            timestamp: Date.now(),
            symbol: position.symbol,
            action: 'CLOSE',
            price: position.currentPrice,
            volume: position.volume,
            profit: position.profit,
            reasoning: `Position closed: ${position.profit > 0 ? 'Profit' : 'Loss'} of $${position.profit.toFixed(2)}`
          };

          this.tradeHistory.push(closeTrade);

          if (this.onTradeExecuted) {
            this.onTradeExecuted(closeTrade);
          }

          // Learn from the trade
          await this.aiEngine.learnFromTrade(
            marketData,
            position.type,
            position.profit
          );
        }
      }
    } catch (error) {
      console.error('Position management error:', error);
    }
  }

  async closeAllPositions(): Promise<void> {
    try {
      const positions = await this.mt5.getPositions();

      for (const position of positions) {
        await this.mt5.closePosition(position.ticket);

        const closeTrade: TradeHistory = {
          id: position.ticket,
          timestamp: Date.now(),
          symbol: position.symbol,
          action: 'CLOSE',
          price: position.currentPrice,
          volume: position.volume,
          profit: position.profit,
          reasoning: 'Manually closed'
        };

        this.tradeHistory.push(closeTrade);

        if (this.onTradeExecuted) {
          this.onTradeExecuted(closeTrade);
        }
      }
    } catch (error) {
      console.error('Error closing positions:', error);
      throw error;
    }
  }

  getStatus(): BotStatus {
    return this.status;
  }

  async getPositions(): Promise<MT5Position[]> {
    if (!this.mt5.isConnected()) {
      return [];
    }
    return this.mt5.getPositions();
  }

  async getAccountInfo() {
    if (!this.mt5.isConnected()) {
      return null;
    }
    return this.mt5.getAccountInfo();
  }

  getTradeHistory(): TradeHistory[] {
    return [...this.tradeHistory];
  }

  async getCurrentPrice(): Promise<number> {
    if (!this.mt5.isConnected()) {
      return 0;
    }
    return this.mt5.getCurrentPrice(this.config.symbol);
  }

  onStatusChanged(callback: (status: BotStatus) => void): void {
    this.onStatusChange = callback;
  }

  onTrade(callback: (trade: TradeHistory) => void): void {
    this.onTradeExecuted = callback;
  }

  onAnalysis(callback: (signal: TradeSignal) => void): void {
    this.onAnalysisComplete = callback;
  }

  private notifyStatusChange(): void {
    if (this.onStatusChange) {
      this.onStatusChange(this.status);
    }
  }
}
