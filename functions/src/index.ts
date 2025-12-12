// functions/src/index.ts
import { onDocumentCreated } from "firebase-functions/v2/firestore";
//import { beforeUserCreated, beforeUserSignedIn } from "firebase-functions/v2/identity";
import { HttpsError } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as cors from "cors"; // Import cors
import { parseCSV, scoreSubmission, ParsedCSV, ScoringResult } from "./scoring";

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// Initialize CORS middleware
const corsHandler = cors({ origin: true });

// -------------------- USER/ADMIN TRIGGERS --------------------
const adminEmails = ["runovastat@gmail.com", "kennedybenard73@gmail.com"];

/*export const assignAdminRole = beforeUserCreated(async (event) => {
  const email = event.data.email?.toLowerCase();
  if (email && adminEmails.includes(email)) {
    logger.info(`Assigning admin role to ${email}`);
    return { customClaims: { role: "admin" } };
  }
  return;
});

export const ensureAdminClaim = beforeUserSignedIn(async (event) => {
  const email = event.data.email?.toLowerCase();
  if (email && adminEmails.includes(email)) {
    logger.info(`Ensuring admin claim on sign-in for ${email}`);
    return { customClaims: { role: "admin" } };
  }
  return;
});
*/
export const createUserRole = onDocumentCreated("users/{userId}", async (event) => {
  const userId = event.params.userId;
  const userData = event.data?.data();
  if (!userData) return;

  const email = userData.email?.toLowerCase();
  if (email && adminEmails.includes(email)) {
    try {
      await db.collection("user_roles").doc(userId).set({
        roles: ["admin", "organizer"],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(`Created admin role document for ${email}`);
    } catch (error) {
      logger.error("Error creating user role:", error);
    }
  }
});

// -------------------- SCORING HANDLER --------------------
interface ScorePayload {
  submissionPath: string;
  groundTruthPath: string;
  competitionId: string;
  competitionType?: "playground" | "competition";
  scoringMethod?: string;
  idColumn?: string;
  targetColumn?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string | null;
}

const scoreSubmissionHandler = async (payload: ScorePayload) => {
  const {
    submissionPath,
    groundTruthPath,
    competitionId,
    competitionType,
    scoringMethod,
    idColumn,
    targetColumn,
    userId,
    userName,
    userAvatar,
  } = payload;

  if (!submissionPath || !competitionId || !groundTruthPath) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required parameters: submissionPath, competitionId, or groundTruthPath"
    );
  }

  try {
    // Download submission CSV
    const submissionFile = storage.bucket().file(submissionPath);
    const [submissionBuffer] = await submissionFile.download();
    const submissionText = submissionBuffer.toString("utf-8");
    const submission = parseCSV(submissionText);
    logger.info(`Parsed submission: ${submission.rowCount} rows`);

    // Download ground truth CSV
    const groundTruthFile = storage.bucket().file(groundTruthPath);
    const [groundTruthBuffer] = await groundTruthFile.download();
    const groundTruthText = groundTruthBuffer.toString("utf-8");
    const groundTruth = parseCSV(groundTruthText);
    logger.info(`Parsed ground truth: ${groundTruth.rowCount} rows`);

    // Basic validation
    const idCol = (idColumn || "id").toLowerCase();
    const targetCol = (targetColumn || "prediction").toLowerCase();
    if (
      !submission.headers.includes(idCol) &&
      !submission.headers.includes(targetCol) &&
      !groundTruth.headers.includes(targetCol)
    ) {
      logger.warn("Submission/ground truth missing expected columns", {
        idCol,
        targetCol,
        submissionHeaders: submission.headers,
        gtHeaders: groundTruth.headers,
      });
    }

    // Compute score
    const result: ScoringResult = scoreSubmission(
      submission as ParsedCSV,
      groundTruth as ParsedCSV,
      scoringMethod || "accuracy",
      idColumn || "id",
      targetColumn || "prediction"
    );
    logger.info("Scoring result:", result);

    // Update leaderboard
    const basePath = competitionType === "playground" ? "playgrounds" : "competitions";
    if (result.valid && userId) {
      const leaderboardRef = db.collection(`${basePath}/${competitionId}/leaderboard`).doc(userId);
      const existingEntry = await leaderboardRef.get();
      const currentSubmissions = existingEntry.exists ? existingEntry.data()?.submissions || 0 : 0;
      const currentBestScore = existingEntry.exists ? existingEntry.data()?.bestScore || 0 : 0;
      const shouldUpdateBest = result.score > currentBestScore;

      await leaderboardRef.set(
        {
          userId,
          userName: userName || "Anonymous",
          userAvatar: userAvatar || null,
          score: result.score,
          bestScore: shouldUpdateBest ? result.score : currentBestScore,
          submissions: currentSubmissions + 1,
          lastSubmission: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info(`Updated leaderboard for user ${userId}, score: ${result.score}`);
    }

    return {
      success: true,
      score: result.score,
      valid: result.valid,
      error: result.error || null,
      details: result.details || null,
    };
  } catch (error: any) {
    logger.error("Error scoring submission:", error);
    throw new HttpsError("internal", `Scoring failed: ${error?.message || String(error)}`);
  }
};

// -------------------- HTTP FUNCTION WITH CORS (REPLACES ONCALL) --------------------
export const scoreSubmissionFunction = functions.https.onRequest(async (req, res) => {
  // Apply CORS middleware
  return corsHandler(req, res, async () => {
    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.status(204).send("");
      return;
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      res.status(405).json({ 
        success: false, 
        error: "Method Not Allowed. Only POST requests are accepted." 
      });
      return;
    }

    // Log the incoming request for debugging
    logger.info("📊 scoreSubmissionFunction called", {
      method: req.method,
      path: req.path,
      hasBody: !!req.body,
      headers: req.headers
    });

    try {
      // Parse and validate the request body
      let payload: ScorePayload;
      
      // Handle different content types
      if (typeof req.body === "string") {
        try {
          payload = JSON.parse(req.body);
        } catch (parseError) {
          logger.error("Failed to parse JSON body:", parseError);
          return res.status(400).json({
            success: false,
            error: "Invalid JSON format in request body"
          });
        }
      } else {
        payload = req.body;
      }

      // Validate required fields
      if (!payload) {
        return res.status(400).json({
          success: false,
          error: "Request body is required"
        });
      }

      const requiredFields = ["submissionPath", "groundTruthPath", "competitionId"];
      const missingFields = requiredFields.filter(field => !payload[field as keyof ScorePayload]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
          missingFields
        });
      }

      logger.info("✅ Valid payload received", {
        competitionId: payload.competitionId,
        competitionType: payload.competitionType,
        userId: payload.userId
      });

      // Process the scoring
      const result = await scoreSubmissionHandler(payload);
      
      logger.info("🎯 Scoring completed", {
        score: result.score,
        valid: result.valid,
        competitionId: payload.competitionId
      });

      // Return success response
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        data: result
      });
      
    } catch (error: any) {
      logger.error("❌ Error in scoreSubmissionFunction:", error);
      
      // Format error response
      const errorResponse = {
        success: false,
        error: error?.message || "Internal server error",
        timestamp: new Date().toISOString()
      };

      // Handle specific error types
      if (error instanceof HttpsError) {
        return res.status(400).json({
          ...errorResponse,
          code: error.code
        });
      }
      
      // Generic server error
      return res.status(500).json(errorResponse);
    }
  });
});

// -------------------- LEGACY HTTP FUNCTION (Optional - keep or remove) --------------------
export const scoreSubmissionHttp = functions.https.onRequest(async (req, res) => {
  // Apply CORS
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Only POST allowed" });
    }

    try {
      const payload = req.body;
      const result = await scoreSubmissionHandler(payload);
      return res.status(200).json(result);
    } catch (err: any) {
      logger.error("HTTP scoring error:", err);
      return res.status(500).json({ success: false, error: err?.message || "Unknown error" });
    }
  });
});

// -------------------- EMAIL/TRIGGER FUNCTIONS --------------------
export const sendTeamInviteEmail = onDocumentCreated("team_invites/{inviteId}", async (event) => {
  const invite = event.data?.data();
  const inviteId = event.params.inviteId;
  if (!invite) return logger.error("No invite data found");

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return logger.warn("RESEND_API_KEY not configured, skipping email");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Juvana <noreply@resend.dev>",
        to: [invite.invitedEmail],
        subject: `You're invited to join team "${invite.teamName}" on Juvana!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4B0082;">Team Invitation</h1>
            <p>Hi there!</p>
            <p><strong>${invite.invitedByName}</strong> has invited you to join their team <strong>"${invite.teamName}"</strong> for a competition on Juvana.</p>
            <div style="margin: 30px 0;">
              <a href="https://juvana.lovable.app/competitions"
                 style="background: linear-gradient(135deg, #4B0082, #6B21A8); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                View Invitation
              </a>
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error("Resend API error:", errorData);
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    await db.collection("team_invites").doc(inviteId).update({
      emailSent: true,
      emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Error sending team invite email:", error);
  }
});

export const onSubmissionCreated = onDocumentCreated(
  "competitions/{competitionId}/submissions/{submissionId}",
  async (event) => {
    const submission = event.data?.data();
    const competitionId = event.params.competitionId;
    const submissionId = event.params.submissionId;
    if (!submission) return logger.error("No submission data found");

    try {
      const competitionDoc = await db.collection("competitions").doc(competitionId).get();
      const competition = competitionDoc.data();
      if (!competition) return logger.error("Competition not found");

      const userDoc = await db.collection("users").doc(submission.userId).get();
      const user = userDoc.data();
      const userEmail = user?.email || submission.userEmail;
      if (!userEmail) return logger.warn("No email found for user");

      logger.info("Email notification for submission scored:", {
        to: userEmail,
        subject: `Your submission for ${competition.title} has been scored!`,
        score: submission.score,
      });

      await db.collection("competitions").doc(competitionId)
        .collection("submissions").doc(submissionId).update({
          emailSent: true,
          emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      logger.error("Error sending submission email:", error);
    }
  }
);

export const onCompetitionStatusChange = onDocumentCreated(
  "competitions/{competitionId}",
  async (event) => {
    const competition = event.data?.data();
    const competitionId = event.params.competitionId;
    if (!competition || competition.status !== "active") return;

    logger.info("Competition started notification:", {
      competitionId,
      title: competition.title,
      message: `Competition "${competition.title}" is now active!`,
    });
  }
);