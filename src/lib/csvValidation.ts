export interface ValidationResult {
  valid: boolean;
  errors: string[];
  rowCount: number;
  headers: string[];
}

export const validateCSV = async (file: File): Promise<ValidationResult> => {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    rowCount: 0,
    headers: [],
  };

  // Check file type
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    result.valid = false;
    result.errors.push('File must be a CSV file');
    return result;
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    result.valid = false;
    result.errors.push('File size must be less than 10MB');
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
    const headers = lines[0].split(',').map(h => h.trim());
    result.headers = headers;

    // Check for required columns (id and prediction)
    if (!headers.includes('id') || !headers.includes('prediction')) {
      result.valid = false;
      result.errors.push('CSV must contain "id" and "prediction" columns');
      return result;
    }

    result.rowCount = lines.length - 1;

    // Validate data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length !== headers.length) {
        result.errors.push(`Row ${i}: Column count mismatch`);
      }
      
      // Check if prediction is a valid number
      const predictionIndex = headers.indexOf('prediction');
      const prediction = parseFloat(values[predictionIndex]);
      if (isNaN(prediction)) {
        result.errors.push(`Row ${i}: Invalid prediction value`);
      }
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

export const calculateScore = (submissionData: any[], groundTruth: any[]): number => {
  // Simple accuracy calculation
  // In production, this would be more sophisticated based on competition metric
  let correct = 0;
  
  for (let i = 0; i < submissionData.length; i++) {
    const submitted = submissionData[i];
    const truth = groundTruth.find(t => t.id === submitted.id);
    
    if (truth && Math.abs(submitted.prediction - truth.value) < 0.001) {
      correct++;
    }
  }
  
  return correct / submissionData.length;
};
