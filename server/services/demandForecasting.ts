import * as db from "../db";

/**
 * ML-Based Demand Forecasting Service
 * 
 * Uses linear regression and time-series analysis to predict future demand
 * based on historical occupancy data, seasonality, and external factors.
 */

interface HistoricalDataPoint {
  date: string;
  occupancyRate: number;
  dayOfWeek: number;
  weekOfYear: number;
  isWeekend: boolean;
  isHoliday: boolean;
}

interface ForecastResult {
  date: string;
  predictedOccupancy: number;
  confidenceInterval: number;
  recommendedPrice: number;
  factors: {
    trend: number;
    seasonality: number;
    dayOfWeek: number;
    special: number;
  };
}

/**
 * Train a simple linear regression model on historical data
 */
function trainLinearRegression(data: HistoricalDataPoint[]): {
  weights: { [key: string]: number };
  intercept: number;
  r2: number;
} {
  if (data.length < 10) {
    // Not enough data for training
    return {
      weights: {
        trend: 0,
        dayOfWeek: 0,
        weekOfYear: 0,
        isWeekend: 0,
      },
      intercept: 70, // Default 70% occupancy
      r2: 0,
    };
  }

  // Prepare features and target
  const features: number[][] = [];
  const target: number[] = [];

  data.forEach((point, index) => {
    features.push([
      index / data.length, // Trend (normalized time)
      point.dayOfWeek / 7, // Day of week (normalized)
      point.weekOfYear / 52, // Week of year (normalized)
      point.isWeekend ? 1 : 0, // Weekend indicator
    ]);
    target.push(point.occupancyRate);
  });

  // Simple linear regression using normal equations
  // For simplicity, we'll use a basic implementation
  // In production, consider using a proper ML library

  const n = features.length;
  const numFeatures = features[0].length;

  // Calculate means
  const meanTarget = target.reduce((sum, val) => sum + val, 0) / n;
  const meanFeatures = features[0].map((_, i) =>
    features.reduce((sum, row) => sum + row[i], 0) / n
  );

  // Calculate weights using simplified approach
  const weights: { [key: string]: number } = {
    trend: 0,
    dayOfWeek: 0,
    weekOfYear: 0,
    isWeekend: 0,
  };

  const featureNames = ["trend", "dayOfWeek", "weekOfYear", "isWeekend"];

  featureNames.forEach((name, i) => {
    let numerator = 0;
    let denominator = 0;

    for (let j = 0; j < n; j++) {
      const featureDiff = features[j][i] - meanFeatures[i];
      const targetDiff = target[j] - meanTarget;
      numerator += featureDiff * targetDiff;
      denominator += featureDiff * featureDiff;
    }

    weights[name] = denominator !== 0 ? numerator / denominator : 0;
  });

  // Calculate intercept
  let intercept = meanTarget;
  featureNames.forEach((name, i) => {
    intercept -= weights[name] * meanFeatures[i];
  });

  // Calculate R²
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    let prediction = intercept;
    featureNames.forEach((name, j) => {
      prediction += weights[name] * features[i][j];
    });

    ssRes += Math.pow(target[i] - prediction, 2);
    ssTot += Math.pow(target[i] - meanTarget, 2);
  }

  const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  return { weights, intercept, r2 };
}

/**
 * Calculate seasonality factor for a given week
 */
function calculateSeasonalityFactor(
  weekOfYear: number,
  historicalData: HistoricalDataPoint[]
): number {
  // Group data by week and calculate average occupancy
  const weeklyAverages: { [week: number]: number[] } = {};

  historicalData.forEach((point) => {
    if (!weeklyAverages[point.weekOfYear]) {
      weeklyAverages[point.weekOfYear] = [];
    }
    weeklyAverages[point.weekOfYear].push(point.occupancyRate);
  });

  // Calculate average for this week
  const weekData = weeklyAverages[weekOfYear];
  if (!weekData || weekData.length === 0) {
    return 1.0; // Neutral factor
  }

  const weekAvg = weekData.reduce((sum, val) => sum + val, 0) / weekData.length;

  // Calculate overall average
  const overallAvg =
    historicalData.reduce((sum, point) => sum + point.occupancyRate, 0) /
    historicalData.length;

  // Return ratio
  return overallAvg !== 0 ? weekAvg / overallAvg : 1.0;
}

/**
 * Detect if a date is a holiday or special event
 */
function isSpecialDate(date: Date): boolean {
  // Israeli holidays (simplified - should use proper Hebrew calendar)
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // New Year's Day
  if (month === 1 && day === 1) return true;

  // Passover (approximate - April)
  if (month === 4 && day >= 15 && day <= 22) return true;

  // Independence Day (approximate - May)
  if (month === 5 && day >= 5 && day <= 6) return true;

  // Rosh Hashanah (approximate - September)
  if (month === 9 && day >= 15 && day <= 17) return true;

  // Yom Kippur (approximate - September/October)
  if (month === 9 && day >= 24 && day <= 25) return true;
  if (month === 10 && day >= 1 && day <= 2) return true;

  // Sukkot (approximate - October)
  if (month === 10 && day >= 5 && day <= 12) return true;

  // Hanukkah (approximate - December)
  if (month === 12 && day >= 10 && day <= 18) return true;

  return false;
}

/**
 * Generate demand forecast for a hotel
 */
export async function generateDemandForecast(
  hotelId: number,
  startDate: string,
  endDate: string,
  basePrice: number = 50000 // Default ₪500
): Promise<ForecastResult[]> {
  // Get historical occupancy data (last 90 days)
  const historicalEndDate = new Date(startDate);
  const historicalStartDate = new Date(historicalEndDate);
  historicalStartDate.setDate(historicalStartDate.getDate() - 90);

  const historicalData = await db.getOccupancyData(
    hotelId,
    historicalStartDate.toISOString().split("T")[0],
    historicalEndDate.toISOString().split("T")[0]
  );

  // Transform to training data
  const trainingData: HistoricalDataPoint[] = historicalData.map((point: any) => {
    const date = new Date(point.occupancyDate);
    return {
      date: point.occupancyDate,
      occupancyRate: point.occupancyRate,
      dayOfWeek: date.getDay(),
      weekOfYear: getWeekOfYear(date),
      isWeekend: date.getDay() === 5 || date.getDay() === 6,
      isHoliday: isSpecialDate(date),
    };
  });

  // Train model
  const model = trainLinearRegression(trainingData);

  // Generate forecasts
  const forecasts: ForecastResult[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const dateStr = date.toISOString().split("T")[0];
    const dayOfWeek = date.getDay();
    const weekOfYear = getWeekOfYear(date);
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isHoliday = isSpecialDate(date);

    // Calculate days from start of historical data
    const daysSinceStart = Math.floor(
      (date.getTime() - historicalStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalDays = 90 + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Predict using model
    const trendFeature = daysSinceStart / totalDays;
    const dayOfWeekFeature = dayOfWeek / 7;
    const weekOfYearFeature = weekOfYear / 52;
    const weekendFeature = isWeekend ? 1 : 0;

    let predictedOccupancy =
      model.intercept +
      model.weights.trend * trendFeature +
      model.weights.dayOfWeek * dayOfWeekFeature +
      model.weights.weekOfYear * weekOfYearFeature +
      model.weights.isWeekend * weekendFeature;

    // Apply seasonality factor
    const seasonalityFactor = calculateSeasonalityFactor(weekOfYear, trainingData);

    // Apply special date boost
    const specialFactor = isHoliday ? 1.2 : 1.0;

    // Combine factors
    predictedOccupancy *= seasonalityFactor * specialFactor;

    // Clamp to 0-100
    predictedOccupancy = Math.max(0, Math.min(100, predictedOccupancy));

    // Calculate confidence interval based on R²
    const confidenceInterval = Math.round((1 - model.r2) * 20); // 0-20% based on model quality

    // Calculate recommended price based on predicted occupancy
    let priceMultiplier = 1.0;

    if (predictedOccupancy >= 90) priceMultiplier = 1.5;
    else if (predictedOccupancy >= 80) priceMultiplier = 1.3;
    else if (predictedOccupancy >= 70) priceMultiplier = 1.15;
    else if (predictedOccupancy >= 60) priceMultiplier = 1.0;
    else if (predictedOccupancy >= 50) priceMultiplier = 0.95;
    else if (predictedOccupancy >= 40) priceMultiplier = 0.9;
    else priceMultiplier = 0.85;

    const recommendedPrice = Math.round(basePrice * priceMultiplier);

    forecasts.push({
      date: dateStr,
      predictedOccupancy: Math.round(predictedOccupancy),
      confidenceInterval,
      recommendedPrice,
      factors: {
        trend: model.weights.trend * trendFeature,
        seasonality: seasonalityFactor - 1,
        dayOfWeek: model.weights.dayOfWeek * dayOfWeekFeature,
        special: specialFactor - 1,
      },
    });
  }

  return forecasts;
}

/**
 * Save forecasts to database
 */
export async function saveForecastsToDatabase(
  hotelId: number,
  forecasts: ForecastResult[]
): Promise<void> {
  for (const forecast of forecasts) {
    await db.createDemandForecast({
      hotelId,
      forecastDate: forecast.date,
      predictedOccupancy: forecast.predictedOccupancy,
      confidenceInterval: forecast.confidenceInterval,
      recommendedPrice: forecast.recommendedPrice,
      modelVersion: "linear_regression_v1",
      factors: JSON.stringify(forecast.factors),
    });
  }
}

/**
 * Get week of year for a date
 */
function getWeekOfYear(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

/**
 * Evaluate model accuracy
 */
export async function evaluateModelAccuracy(
  hotelId: number,
  testStartDate: string,
  testEndDate: string
): Promise<{
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  accuracy: number; // Percentage accuracy
}> {
  // Get actual occupancy data for test period
  const actualData = await db.getOccupancyData(hotelId, testStartDate, testEndDate);

  if (actualData.length === 0) {
    return { mae: 0, rmse: 0, accuracy: 0 };
  }

  // Get forecasts for the same period
  const forecasts = await db.getDemandForecasts(hotelId, testStartDate, testEndDate);

  if (forecasts.length === 0) {
    return { mae: 0, rmse: 0, accuracy: 0 };
  }

  // Calculate errors
  let sumAbsError = 0;
  let sumSqError = 0;
  let count = 0;

  actualData.forEach((actual: any) => {
    const forecast = forecasts.find((f: any) => f.forecastDate === actual.occupancyDate);
    if (forecast) {
      const error = Math.abs(actual.occupancyRate - forecast.predictedOccupancy);
      sumAbsError += error;
      sumSqError += error * error;
      count++;
    }
  });

  if (count === 0) {
    return { mae: 0, rmse: 0, accuracy: 0 };
  }

  const mae = sumAbsError / count;
  const rmse = Math.sqrt(sumSqError / count);
  const accuracy = Math.max(0, 100 - mae);

  return { mae, rmse, accuracy };
}
