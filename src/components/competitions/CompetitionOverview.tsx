import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trophy, Users, Target, FileText, AlertCircle } from "lucide-react";
import { Competition } from "@/types/competition";

interface CompetitionOverviewProps {
  competition: Competition;
}

export const CompetitionOverview = ({ competition }: CompetitionOverviewProps) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const daysRemaining = Math.ceil(
    (new Date(competition.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6">
      {/* Timeline Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Deadline</p>
              <p className="font-semibold">{formatDate(competition.deadline)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Time Remaining</p>
              <Badge variant={daysRemaining <= 7 ? "destructive" : "secondary"} className="text-sm">
                {daysRemaining > 0 ? `${daysRemaining} days left` : "Competition ended"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {competition.description}
          </p>
        </CardContent>
      </Card>

      {/* Prize & Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              Prize
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-accent">{competition.prize}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{competition.participants}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rules Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• One account per participant. No team merging.</p>
            <p>• {competition.submissionFormat?.maxSubmissionsPerDay || 5} submissions per day maximum.</p>
            <p>• No private sharing of code or data with other participants.</p>
            <p>• Submissions must be your own work.</p>
            <p>• External data allowed only if publicly available.</p>
            <p>• Final submissions must be selected before deadline.</p>
          </div>
        </CardContent>
      </Card>

      {/* Evaluation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Evaluation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Metric:</span>
            <Badge variant="outline" className="uppercase">
              {competition.evaluationMetric || "Accuracy"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Submissions are evaluated based on {competition.evaluationMetric || "accuracy"} score. 
            Higher scores rank higher on the leaderboard.
          </p>
          {competition.submissionFormat && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg space-y-2">
              <p className="font-medium text-sm">Submission Format:</p>
              <p className="text-sm text-muted-foreground">
                Required columns: {competition.submissionFormat.requiredColumns?.join(", ") || "id, prediction"}
              </p>
              <p className="text-sm text-muted-foreground">
                Prediction type: {competition.submissionFormat.predictionType || "numeric"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
