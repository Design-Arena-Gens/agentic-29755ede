import { MarketData } from './aiEngine';

export interface MT5Config {
  accountNumber: string;
  password: string;
  server: string;
  symbol: string;
}

export interface MT5Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss: number;
  takeProfit: number;
  openTime: number;
}

export interface MT5AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  profit: number;
  leverage: number;
}

// Simulated MT5 Bridge for web demo
// In production, this would connect to a backend server that communicates with MT5
export class MT5Bridge {
  private config: MT5Config | null = null;
  private connected: boolean = false;
  private positions: MT5Position[] = [];
  private accountInfo: MT5AccountInfo = {
    balance: 10000,
    equity: 10000,
    margin: 0,
    freeMargin: 10000,
    profit: 0,
    leverage: 100
  };
  private marketDataHistory: Map<string, MarketData[]> = new Map();
  private simulatedPrice: number = 1.0950; // EUR/USD starting price

  async connect(config: MT5Config): Promise<boolean> {
    this.config = config;

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Validate config (in production, this would actually connect to MT5)
    if (!config.accountNumber || !config.password || !config.server) {
      throw new Error('Invalid MT5 credentials');
    }

    this.connected = true;
    this.initializeMarketData(config.symbol);
    return true;
  }

  disconnect() {
    this.connected = false;
    this.config = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private initializeMarketData(symbol: string) {
    // Generate initial historical data
    const history: MarketData[] = [];
    let price = this.simulatedPrice;
    const now = Date.now();

    for (let i = 100; i >= 0; i--) {
      const change = (Math.random() - 0.5) * 0.0020;
      price = price * (1 + change);

      const open = price;
      const close = price * (1 + (Math.random() - 0.5) * 0.0010);
      const high = Math.max(open, close) * (1 + Math.random() * 0.0005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.0005);

      history.push({
        timestamp: now - (i * 60000), // 1 minute bars
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000 + 500
      });
    }

    this.marketDataHistory.set(symbol, history);
    this.simulatedPrice = history[history.length - 1].close;
  }

  async getMarketData(symbol: string, bars: number = 100): Promise<MarketData[]> {
    if (!this.connected) {
      throw new Error('Not connected to MT5');
    }

    // Simulate real-time price updates
    this.updateMarketData(symbol);

    const history = this.marketDataHistory.get(symbol) || [];
    return history.slice(-bars);
  }

  private updateMarketData(symbol: string) {
    const history = this.marketDataHistory.get(symbol);
    if (!history) return;

    // Generate new candle
    const change = (Math.random() - 0.5) * 0.0015;
    this.simulatedPrice = this.simulatedPrice * (1 + change);

    const open = history[history.length - 1].close;
    const close = this.simulatedPrice;
    const high = Math.max(open, close) * (1 + Math.random() * 0.0005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.0005);

    history.push({
      timestamp: Date.now(),
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000 + 500
    });

    // Keep only last 200 bars
    if (history.length > 200) {
      history.shift();
    }
  }

  async openPosition(
    symbol: string,
    type: 'BUY' | 'SELL',
    volume: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<MT5Position> {
    if (!this.connected) {
      throw new Error('Not connected to MT5');
    }

    const marketData = await this.getMarketData(symbol, 1);
    const currentPrice = marketData[0].close;

    const position: MT5Position = {
      ticket: Date.now(),
      symbol,
      type,
      volume,
      openPrice: currentPrice,
      currentPrice,
      profit: 0,
      stopLoss,
      takeProfit,
      openTime: Date.now()
    };

    this.positions.push(position);
    this.updateAccountInfo();

    return position;
  }

  async closePosition(ticket: number): Promise<number> {
    if (!this.connected) {
      throw new Error('Not connected to MT5');
    }

    const positionIndex = this.positions.findIndex(p => p.ticket === ticket);
    if (positionIndex === -1) {
      throw new Error('Position not found');
    }

    const position = this.positions[positionIndex];
    const profit = position.profit;

    // Update account balance
    this.accountInfo.balance += profit;
    this.accountInfo.profit -= profit;

    this.positions.splice(positionIndex, 1);
    this.updateAccountInfo();

    return profit;
  }

  async getPositions(): Promise<MT5Position[]> {
    if (!this.connected) {
      throw new Error('Not connected to MT5');
    }

    // Update all positions with current prices
    for (const position of this.positions) {
      const marketData = await this.getMarketData(position.symbol, 1);
      const currentPrice = marketData[0].close;

      position.currentPrice = currentPrice;

      // Calculate profit
      const priceDiff = position.type === 'BUY'
        ? currentPrice - position.openPrice
        : position.openPrice - currentPrice;

      position.profit = priceDiff * position.volume * 100000; // Standard lot

      // Check stop loss and take profit
      if (position.type === 'BUY') {
        if (currentPrice <= position.stopLoss || currentPrice >= position.takeProfit) {
          await this.closePosition(position.ticket);
        }
      } else {
        if (currentPrice >= position.stopLoss || currentPrice <= position.takeProfit) {
          await this.closePosition(position.ticket);
        }
      }
    }

    return [...this.positions];
  }

  async getAccountInfo(): Promise<MT5AccountInfo> {
    if (!this.connected) {
      throw new Error('Not connected to MT5');
    }

    this.updateAccountInfo();
    return { ...this.accountInfo };
  }

  private updateAccountInfo() {
    const totalProfit = this.positions.reduce((sum, p) => sum + p.profit, 0);
    const totalMargin = this.positions.reduce((sum, p) => {
      return sum + (p.volume * p.openPrice * 100000 / this.accountInfo.leverage);
    }, 0);

    this.accountInfo.profit = totalProfit;
    this.accountInfo.equity = this.accountInfo.balance + totalProfit;
    this.accountInfo.margin = totalMargin;
    this.accountInfo.freeMargin = this.accountInfo.equity - totalMargin;
  }

  getCurrentPrice(symbol: string): number {
    const history = this.marketDataHistory.get(symbol);
    if (!history || history.length === 0) return 0;
    return history[history.length - 1].close;
  }
}
