// Backend scoring utilities for Firebase Cloud Functions

export interface ScoringResult {
  score: number;
  valid: boolean;
  error?: string;
  details?: {
    totalRows: number;
    matchedRows: number;
    correctPredictions?: number;
  };
}

export interface ParsedCSV {
  headers: string[];
  data: Record<string, string>[];
  rowCount: number;
}

/**
 * Parse CSV text into structured data
 */
export const parseCSV = (text: string): ParsedCSV => {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 1) {
    return { headers: [], data: [], rowCount: 0 };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      data.push(row);
    }
  }

  return { headers, data, rowCount: data.length };
};

/**
 * Calculate accuracy score
 */
export const calculateAccuracy = (
  submission: ParsedCSV,
  groundTruth: ParsedCSV,
  idColumn: string,
  targetColumn: string
): ScoringResult => {
  const idCol = idColumn.toLowerCase();
  const targetCol = targetColumn.toLowerCase();

  const truthMap = new Map<string, string>();
  for (const row of groundTruth.data) {
    truthMap.set(String(row[idCol]), String(row[targetCol]));
  }

  let matched = 0;
  let correct = 0;

  for (const row of submission.data) {
    const id = String(row[idCol]);
    const prediction = String(row[targetCol]);
    const actual = truthMap.get(id);

    if (actual !== undefined) {
      matched++;
      const predNum = parseFloat(prediction);
      const actNum = parseFloat(actual);
      
      if (!isNaN(predNum) && !isNaN(actNum)) {
        if (Math.round(predNum) === Math.round(actNum)) {
          correct++;
        }
      } else if (prediction.toLowerCase() === actual.toLowerCase()) {
        correct++;
      }
    }
  }

  if (matched === 0) {
    return { score: 0, valid: false, error: "No matching IDs found" };
  }

  return {
    score: correct / matched,
    valid: true,
    details: { totalRows: submission.rowCount, matchedRows: matched, correctPredictions: correct },
  };
};

/**
 * Calculate RMSE (Root Mean Squared Error)
 */
export const calculateRMSE = (
  submission: ParsedCSV,
  groundTruth: ParsedCSV,
  idColumn: string,
  targetColumn: string
): ScoringResult => {
  const idCol = idColumn.toLowerCase();
  const targetCol = targetColumn.toLowerCase();

  const truthMap = new Map<string, number>();
  for (const row of groundTruth.data) {
    const val = parseFloat(row[targetCol]);
    if (!isNaN(val)) {
      truthMap.set(String(row[idCol]), val);
    }
  }

  let matched = 0;
  let sumSquaredError = 0;

  for (const row of submission.data) {
    const id = String(row[idCol]);
    const prediction = parseFloat(row[targetCol]);
    const actual = truthMap.get(id);

    if (actual !== undefined && !isNaN(prediction)) {
      matched++;
      const error = prediction - actual;
      sumSquaredError += error * error;
    }
  }

  if (matched === 0) {
    return { score: 0, valid: false, error: "No valid numeric predictions" };
  }

  const rmse = Math.sqrt(sumSquaredError / matched);
  const score = 1 / (1 + rmse);

  return { score, valid: true, details: { totalRows: submission.rowCount, matchedRows: matched } };
};

/**
 * Calculate MAE (Mean Absolute Error)
 */
export const calculateMAE = (
  submission: ParsedCSV,
  groundTruth: ParsedCSV,
  idColumn: string,
  targetColumn: string
): ScoringResult => {
  const idCol = idColumn.toLowerCase();
  const targetCol = targetColumn.toLowerCase();

  const truthMap = new Map<string, number>();
  for (const row of groundTruth.data) {
    const val = parseFloat(row[targetCol]);
    if (!isNaN(val)) {
      truthMap.set(String(row[idCol]), val);
    }
  }

  let matched = 0;
  let sumAbsError = 0;

  for (const row of submission.data) {
    const id = String(row[idCol]);
    const prediction = parseFloat(row[targetCol]);
    const actual = truthMap.get(id);

    if (actual !== undefined && !isNaN(prediction)) {
      matched++;
      sumAbsError += Math.abs(prediction - actual);
    }
  }

  if (matched === 0) {
    return { score: 0, valid: false, error: "No valid numeric predictions" };
  }

  const mae = sumAbsError / matched;
  const score = 1 / (1 + mae);

  return { score, valid: true, details: { totalRows: submission.rowCount, matchedRows: matched } };
};

/**
 * Calculate F1 Score (binary classification)
 */
export const calculateF1 = (
  submission: ParsedCSV,
  groundTruth: ParsedCSV,
  idColumn: string,
  targetColumn: string
): ScoringResult => {
  const idCol = idColumn.toLowerCase();
  const targetCol = targetColumn.toLowerCase();

  const truthMap = new Map<string, number>();
  for (const row of groundTruth.data) {
    truthMap.set(String(row[idCol]), parseFloat(row[targetCol]) || 0);
  }

  let tp = 0, fp = 0, fn = 0;
  let matched = 0;

  for (const row of submission.data) {
    const id = String(row[idCol]);
    const prediction = Math.round(parseFloat(row[targetCol]) || 0);
    const actual = truthMap.get(id);

    if (actual !== undefined) {
      matched++;
      if (prediction === 1 && actual === 1) tp++;
      else if (prediction === 1 && actual === 0) fp++;
      else if (prediction === 0 && actual === 1) fn++;
    }
  }

  if (matched === 0) {
    return { score: 0, valid: false, error: "No matching IDs found" };
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  return { score: f1, valid: true, details: { totalRows: submission.rowCount, matchedRows: matched } };
};

/**
 * Main scoring function that routes to appropriate metric
 */
export const scoreSubmission = (
  submission: ParsedCSV,
  groundTruth: ParsedCSV,
  metric: string,
  idColumn: string = "id",
  targetColumn: string = "prediction"
): ScoringResult => {
  switch (metric.toLowerCase()) {
    case "accuracy":
      return calculateAccuracy(submission, groundTruth, idColumn, targetColumn);
    case "rmse":
      return calculateRMSE(submission, groundTruth, idColumn, targetColumn);
    case "mae":
      return calculateMAE(submission, groundTruth, idColumn, targetColumn);
    case "f1":
      return calculateF1(submission, groundTruth, idColumn, targetColumn);
    default:
      return calculateAccuracy(submission, groundTruth, idColumn, targetColumn);
  }
};