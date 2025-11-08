import * as tf from '@tensorflow/tfjs';

export interface MarketData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  reasoning: string;
}

export class AITradingEngine {
  private model: tf.LayersModel | null = null;
  private isTraining: boolean = false;

  constructor() {
    this.initializeModel();
  }

  private async initializeModel() {
    // Create a neural network for trading decisions
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [20], units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' }) // BUY, SELL, HOLD
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
  }

  // Technical indicators calculation
  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1];
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1];
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(data.slice(0, period), period);

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  private calculateRSI(data: number[], period: number = 14): number {
    if (data.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(data: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const macd = ema12 - ema26;

    // Signal line (9-period EMA of MACD)
    const macdLine = [macd];
    const signal = this.calculateEMA(macdLine, 9);
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  private calculateBollingerBands(data: number[], period: number = 20): { upper: number; middle: number; lower: number } {
    const sma = this.calculateSMA(data, period);
    const slice = data.slice(-period);
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: sma + (2 * stdDev),
      middle: sma,
      lower: sma - (2 * stdDev)
    };
  }

  // Feature extraction from market data
  private extractFeatures(marketData: MarketData[]): number[] {
    const closes = marketData.map(d => d.close);
    const volumes = marketData.map(d => d.volume);

    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const rsi = this.calculateRSI(closes);
    const macd = this.calculateMACD(closes);
    const bb = this.calculateBollingerBands(closes);

    const currentPrice = closes[closes.length - 1];
    const volumeAvg = this.calculateSMA(volumes, 20);
    const currentVolume = volumes[volumes.length - 1];

    // Normalize features
    return [
      (currentPrice - sma20) / sma20,
      (currentPrice - sma50) / sma50,
      (ema12 - ema26) / currentPrice,
      (rsi - 50) / 50,
      macd.macd / currentPrice,
      macd.histogram / currentPrice,
      (currentPrice - bb.middle) / (bb.upper - bb.lower),
      (currentPrice - bb.lower) / currentPrice,
      (bb.upper - currentPrice) / currentPrice,
      (currentVolume - volumeAvg) / volumeAvg,
      // Price momentum
      (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2],
      (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5],
      (closes[closes.length - 1] - closes[closes.length - 10]) / closes[closes.length - 10],
      // Volatility
      Math.sqrt(closes.slice(-10).reduce((sum, c, i, arr) => {
        if (i === 0) return 0;
        return sum + Math.pow((c - arr[i-1]) / arr[i-1], 2);
      }, 0) / 10),
      // Trend strength
      (sma20 - sma50) / sma50,
      // Support/Resistance
      Math.min(...closes.slice(-20)) / currentPrice,
      Math.max(...closes.slice(-20)) / currentPrice,
      // Volume trend
      (volumes[volumes.length - 1] - volumes[volumes.length - 2]) / volumes[volumes.length - 2],
      // MACD signal
      macd.signal / currentPrice,
      // RSI momentum
      (rsi - this.calculateRSI(closes.slice(0, -1))) / 100
    ];
  }

  // AI-based trade analysis
  async analyzeMarket(marketData: MarketData[]): Promise<TradeSignal> {
    if (!this.model || marketData.length < 50) {
      return {
        action: 'HOLD',
        confidence: 0,
        stopLoss: 0,
        takeProfit: 0,
        lotSize: 0,
        reasoning: 'Insufficient data for analysis'
      };
    }

    try {
      const features = this.extractFeatures(marketData);
      const inputTensor = tf.tensor2d([features]);

      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();

      inputTensor.dispose();
      prediction.dispose();

      const [buyProb, sellProb, holdProb] = Array.from(predictionData);
      const maxProb = Math.max(buyProb, sellProb, holdProb);

      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (maxProb === buyProb) action = 'BUY';
      else if (maxProb === sellProb) action = 'SELL';

      const currentPrice = marketData[marketData.length - 1].close;
      const closes = marketData.map(d => d.close);
      const atr = this.calculateATR(marketData);
      const rsi = this.calculateRSI(closes);
      const macd = this.calculateMACD(closes);

      // Risk management calculations
      const stopLossDistance = atr * 2;
      const takeProfitDistance = atr * 3;

      const stopLoss = action === 'BUY'
        ? currentPrice - stopLossDistance
        : currentPrice + stopLossDistance;

      const takeProfit = action === 'BUY'
        ? currentPrice + takeProfitDistance
        : currentPrice - takeProfitDistance;

      // Dynamic lot sizing based on confidence
      const riskPercent = 0.02; // Risk 2% per trade
      const lotSize = Math.min(0.1 * maxProb, 0.05); // Max 0.05 lots

      // Generate reasoning
      const reasoning = this.generateReasoning(action, maxProb, rsi, macd, closes);

      return {
        action,
        confidence: maxProb * 100,
        stopLoss,
        takeProfit,
        lotSize,
        reasoning
      };
    } catch (error) {
      console.error('Analysis error:', error);
      return {
        action: 'HOLD',
        confidence: 0,
        stopLoss: 0,
        takeProfit: 0,
        lotSize: 0,
        reasoning: 'Analysis failed'
      };
    }
  }

  private calculateATR(data: MarketData[], period: number = 14): number {
    if (data.length < period + 1) return 0;

    const trueRanges = [];
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    return this.calculateSMA(trueRanges.slice(-period), period);
  }

  private generateReasoning(
    action: string,
    confidence: number,
    rsi: number,
    macd: { macd: number; signal: number; histogram: number },
    closes: number[]
  ): string {
    const reasons = [];

    if (action === 'BUY') {
      if (rsi < 30) reasons.push('RSI oversold');
      if (macd.histogram > 0) reasons.push('MACD bullish');
      if (closes[closes.length - 1] > closes[closes.length - 5]) reasons.push('Uptrend detected');
    } else if (action === 'SELL') {
      if (rsi > 70) reasons.push('RSI overbought');
      if (macd.histogram < 0) reasons.push('MACD bearish');
      if (closes[closes.length - 1] < closes[closes.length - 5]) reasons.push('Downtrend detected');
    } else {
      reasons.push('Market conditions unclear');
    }

    return `${action} signal (${confidence.toFixed(1)}% confidence): ${reasons.join(', ')}`;
  }

  // Self-learning from trade results
  async learnFromTrade(
    marketData: MarketData[],
    action: 'BUY' | 'SELL' | 'HOLD',
    profitLoss: number
  ) {
    if (!this.model || this.isTraining) return;

    this.isTraining = true;

    try {
      const features = this.extractFeatures(marketData);
      const inputTensor = tf.tensor2d([features]);

      // Create label based on actual outcome
      let label: number[];
      if (profitLoss > 0) {
        // Winning trade - reinforce the action
        label = action === 'BUY' ? [1, 0, 0] : action === 'SELL' ? [0, 1, 0] : [0, 0, 1];
      } else {
        // Losing trade - learn to avoid
        label = action === 'BUY' ? [0, 1, 0] : action === 'SELL' ? [1, 0, 0] : [0, 0, 1];
      }

      const labelTensor = tf.tensor2d([label]);

      await this.model.fit(inputTensor, labelTensor, {
        epochs: 1,
        verbose: 0
      });

      inputTensor.dispose();
      labelTensor.dispose();
    } catch (error) {
      console.error('Learning error:', error);
    } finally {
      this.isTraining = false;
    }
  }
}
