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
}
