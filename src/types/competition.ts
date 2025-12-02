export interface Competition {
  id: string;
  title: string;
  description: string;
  prize: string;
  deadline: Date;
  participants: number;
  category: string;
  imageUrl?: string;
  status: "active" | "upcoming" | "completed";
  organizerName: string;
  organizerLogo?: string;
  // Submission requirements
  submissionFormat?: {
    requiredColumns: string[];
    predictionType: "numeric" | "classification" | "text";
    maxSubmissionsPerDay?: number;
    maxFileSize?: number;
  };
  evaluationMetric?: "accuracy" | "rmse" | "mae" | "f1" | "auc";
  groundTruthPath?: string;
  datasetId?: string;
}

export interface Submission {
  id: string;
  competitionId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  score: number;
  submittedAt: Date;
  notebookUrl?: string;
  fileName?: string;
  fileUrl?: string;
  rowCount?: number;
  status: "pending" | "scored" | "error";
  errorMessage?: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  score: number;
  submissions: number;
  lastSubmission: Date;
  bestScore?: number;
}
