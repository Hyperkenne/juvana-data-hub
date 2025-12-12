"use strict";
// functions/src/scoring.ts
// Backend scoring utilities for Firebase Cloud Functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreSubmission = exports.calculateF1 = exports.calculateMAE = exports.calculateRMSE = exports.calculateAccuracy = exports.parseCSV = void 0;
/**
 * Robust CSV parser that handles quoted fields (commas inside quotes).
 * Returns headers (lowercased and trimmed) and array of row objects.
 */
const parseCSV = (text) => {
    // Normalize newlines
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    // Trim empty trailing lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === "")
        lines.pop();
    if (lines.length === 0) {
        return { headers: [], data: [], rowCount: 0 };
    }
    // CSV line parser (handles quoted fields)
    const parseLine = (line) => {
        const result = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                // If next char is quote, it's an escaped quote
                if (inQuotes && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                }
                else {
                    inQuotes = !inQuotes;
                }
            }
            else if (ch === "," && !inQuotes) {
                result.push(cur);
                cur = "";
            }
            else {
                cur += ch;
            }
        }
        result.push(cur);
        return result.map(s => s.trim());
    };
    const headersRaw = parseLine(lines[0]);
    const headers = headersRaw.map(h => h.trim().toLowerCase());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim())
            continue;
        const values = parseLine(lines[i]);
        // allow rows with equal or fewer columns - ignore rows with wrong column count
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((h, idx) => (row[h] = values[idx]));
            data.push(row);
        }
        else {
            // skip row if columns mismatch; this prevents throwing on e.g. newline inside quoted fields
            continue;
        }
    }
    return { headers, data, rowCount: data.length };
};
exports.parseCSV = parseCSV;
/**
 * Calculate accuracy score
 */
const calculateAccuracy = (submission, groundTruth, idColumn, targetColumn) => {
    const idCol = idColumn.toLowerCase();
    const targetCol = targetColumn.toLowerCase();
    const truthMap = new Map();
    for (const row of groundTruth.data) {
        if (row[idCol] !== undefined && row[targetCol] !== undefined) {
            truthMap.set(String(row[idCol]), String(row[targetCol]));
        }
    }
    let matched = 0;
    let correct = 0;
    for (const row of submission.data) {
        if (row[idCol] === undefined || row[targetCol] === undefined)
            continue;
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
            }
            else if (prediction.toLowerCase() === actual.toLowerCase()) {
                correct++;
            }
        }
    }
    if (matched === 0) {
        return { score: 0, valid: false, error: "No matching IDs found", details: { totalRows: submission.rowCount, matchedRows: 0 } };
    }
    return {
        score: correct / matched,
        valid: true,
        details: { totalRows: submission.rowCount, matchedRows: matched, correctPredictions: correct },
    };
};
exports.calculateAccuracy = calculateAccuracy;
/**
 * Calculate RMSE (Root Mean Squared Error)
 */
const calculateRMSE = (submission, groundTruth, idColumn, targetColumn) => {
    const idCol = idColumn.toLowerCase();
    const targetCol = targetColumn.toLowerCase();
    const truthMap = new Map();
    for (const row of groundTruth.data) {
        const val = parseFloat(row[targetCol]);
        if (!isNaN(val) && row[idCol] !== undefined) {
            truthMap.set(String(row[idCol]), val);
        }
    }
    let matched = 0;
    let sumSquaredError = 0;
    for (const row of submission.data) {
        if (row[idCol] === undefined || row[targetCol] === undefined)
            continue;
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
        return { score: 0, valid: false, error: "No valid numeric predictions", details: { totalRows: submission.rowCount, matchedRows: 0 } };
    }
    const rmse = Math.sqrt(sumSquaredError / matched);
    const score = 1 / (1 + rmse); // normalized so higher is better
    return { score, valid: true, details: { totalRows: submission.rowCount, matchedRows: matched } };
};
exports.calculateRMSE = calculateRMSE;
/**
 * Calculate MAE (Mean Absolute Error)
 */
const calculateMAE = (submission, groundTruth, idColumn, targetColumn) => {
    const idCol = idColumn.toLowerCase();
    const targetCol = targetColumn.toLowerCase();
    const truthMap = new Map();
    for (const row of groundTruth.data) {
        const val = parseFloat(row[targetCol]);
        if (!isNaN(val) && row[idCol] !== undefined) {
            truthMap.set(String(row[idCol]), val);
        }
    }
    let matched = 0;
    let sumAbsError = 0;
    for (const row of submission.data) {
        if (row[idCol] === undefined || row[targetCol] === undefined)
            continue;
        const id = String(row[idCol]);
        const prediction = parseFloat(row[targetCol]);
        const actual = truthMap.get(id);
        if (actual !== undefined && !isNaN(prediction)) {
            matched++;
            sumAbsError += Math.abs(prediction - actual);
        }
    }
    if (matched === 0) {
        return { score: 0, valid: false, error: "No valid numeric predictions", details: { totalRows: submission.rowCount, matchedRows: 0 } };
    }
    const mae = sumAbsError / matched;
    const score = 1 / (1 + mae);
    return { score, valid: true, details: { totalRows: submission.rowCount, matchedRows: matched } };
};
exports.calculateMAE = calculateMAE;
/**
 * Calculate F1 Score (binary classification)
 */
const calculateF1 = (submission, groundTruth, idColumn, targetColumn) => {
    const idCol = idColumn.toLowerCase();
    const targetCol = targetColumn.toLowerCase();
    const truthMap = new Map();
    for (const row of groundTruth.data) {
        const parsed = parseFloat(row[targetCol]);
        truthMap.set(String(row[idCol]), isNaN(parsed) ? 0 : Math.round(parsed));
    }
    let tp = 0, fp = 0, fn = 0;
    let matched = 0;
    for (const row of submission.data) {
        if (row[idCol] === undefined || row[targetCol] === undefined)
            continue;
        const id = String(row[idCol]);
        const prediction = Math.round(parseFloat(row[targetCol]) || 0);
        const actual = truthMap.get(id);
        if (actual !== undefined) {
            matched++;
            if (prediction === 1 && actual === 1)
                tp++;
            else if (prediction === 1 && actual === 0)
                fp++;
            else if (prediction === 0 && actual === 1)
                fn++;
        }
    }
    if (matched === 0) {
        return { score: 0, valid: false, error: "No matching IDs found", details: { totalRows: submission.rowCount, matchedRows: 0 } };
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    return { score: f1, valid: true, details: { totalRows: submission.rowCount, matchedRows: matched } };
};
exports.calculateF1 = calculateF1;
/**
 * Main scoring function that routes to appropriate metric
 */
const scoreSubmission = (submission, groundTruth, metric, idColumn = "id", targetColumn = "prediction") => {
    switch (metric.toLowerCase()) {
        case "accuracy":
            return (0, exports.calculateAccuracy)(submission, groundTruth, idColumn, targetColumn);
        case "rmse":
            return (0, exports.calculateRMSE)(submission, groundTruth, idColumn, targetColumn);
        case "mae":
            return (0, exports.calculateMAE)(submission, groundTruth, idColumn, targetColumn);
        case "f1":
            return (0, exports.calculateF1)(submission, groundTruth, idColumn, targetColumn);
        default:
            return (0, exports.calculateAccuracy)(submission, groundTruth, idColumn, targetColumn);
    }
};
exports.scoreSubmission = scoreSubmission;
//# sourceMappingURL=scoring.js.map