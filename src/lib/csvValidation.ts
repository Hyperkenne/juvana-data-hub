export interface ValidationResult {
  valid: boolean;
  errors: string[];
  rowCount: number;
  headers: string[];
  data?: any[];
}

export interface SubmissionRequirements {
  requiredColumns: string[];
  predictionType: "numeric" | "classification" | "text";
  maxFileSize?: number; // in MB
}

const DEFAULT_REQUIREMENTS: SubmissionRequirements = {
  requiredColumns: ["id", "prediction"],
  predictionType: "numeric",
  maxFileSize: 10,
};

export const validateCSV = async (
  file: File,
  requirements: SubmissionRequirements = DEFAULT_REQUIREMENTS
): Promise<ValidationResult> => {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    rowCount: 0,
    headers: [],
    data: [],
  };

  // Check file type
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    result.valid = false;
    result.errors.push('File must be a CSV file');
    return result;
  }

  // Check file size
  const maxSize = (requirements.maxFileSize || 10) * 1024 * 1024;
  if (file.size > maxSize) {
    result.valid = false;
    result.errors.push(`File size must be less than ${requirements.maxFileSize || 10}MB`);
    return result;
  }

  try {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      result.valid = false;
      result.errors.push('CSV must contain at least a header row and one data row');
      return result;
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    result.headers = headers;

    // Check for required columns
    const missingColumns = requirements.requiredColumns.filter(
      col => !headers.includes(col.toLowerCase())
    );
    
    if (missingColumns.length > 0) {
      result.valid = false;
      result.errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
      return result;
    }

    result.rowCount = lines.length - 1;
    const data: any[] = [];

    // Validate data rows
    const predictionIndex = headers.indexOf('prediction');
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      if (values.length !== headers.length) {
        result.errors.push(`Row ${i}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
        continue;
      }
      
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      // Validate prediction based on type
      if (predictionIndex !== -1) {
        const predValue = values[predictionIndex];
        
        if (requirements.predictionType === "numeric") {
          const prediction = parseFloat(predValue);
          if (isNaN(prediction)) {
            result.errors.push(`Row ${i}: Prediction must be a number, got "${predValue}"`);
          }
        } else if (requirements.predictionType === "classification") {
          if (!predValue || predValue.trim() === "") {
            result.errors.push(`Row ${i}: Prediction cannot be empty`);
          }
        }
      }

      data.push(row);
    }

    result.data = data;

    // Limit errors shown
    if (result.errors.length > 5) {
      const totalErrors = result.errors.length;
      result.errors = result.errors.slice(0, 5);
      result.errors.push(`... and ${totalErrors - 5} more errors`);
    }

    if (result.errors.length > 0) {
      result.valid = false;
    }

  } catch (error) {
    result.valid = false;
    result.errors.push('Failed to parse CSV file');
  }

  return result;
};

export const calculateScore = (
  submissionData: any[],
  groundTruth: any[],
  metric: "accuracy" | "rmse" | "mae" | "f1" | "auc" = "accuracy"
): number => {
  if (!submissionData.length || !groundTruth.length) return 0;

  // Create lookup map for ground truth
  const truthMap = new Map(groundTruth.map(t => [String(t.id), t]));
  
  let matched = 0;
  let totalSquaredError = 0;
  let totalAbsError = 0;
  let correctPredictions = 0;

  for (const submission of submissionData) {
    const truth = truthMap.get(String(submission.id));
    if (!truth) continue;
    
    matched++;
    const predicted = parseFloat(submission.prediction);
    const actual = parseFloat(truth.target || truth.value || truth.prediction);
    
    if (isNaN(predicted) || isNaN(actual)) continue;

    const error = predicted - actual;
    totalSquaredError += error * error;
    totalAbsError += Math.abs(error);
    
    // For classification (rounded to nearest integer)
    if (Math.round(predicted) === Math.round(actual)) {
      correctPredictions++;
    }
  }

  if (matched === 0) return 0;

  switch (metric) {
    case "accuracy":
      return correctPredictions / matched;
    case "rmse":
      // Return inverse so higher is better for leaderboard
      const rmse = Math.sqrt(totalSquaredError / matched);
      return 1 / (1 + rmse);
    case "mae":
      const mae = totalAbsError / matched;
      return 1 / (1 + mae);
    default:
      return correctPredictions / matched;
  }
};

export const parseGroundTruth = async (text: string): Promise<any[]> => {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });
    data.push(row);
  }

  return data;
};
