import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {beforeUserCreated, beforeUserSignedIn} from "firebase-functions/v2/identity";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {parseCSV, scoreSubmission} from "./scoring";

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

/**
 * Automatically assign admin role to specific email addresses
 */
export const assignAdminRole = beforeUserCreated(async (event) => {
  const email = event.data.email?.toLowerCase();
  const adminEmails = ["runovastat@gmail.com", "kennedybenard73@gmail.com"];
  
  if (email && adminEmails.includes(email)) {
    logger.info(`Assigning admin role to ${email}`);
    return { customClaims: { role: "admin" } };
  }
  return;
});

/**
 * Ensure admin claim is applied on every sign-in for eligible users
 */
export const ensureAdminClaim = beforeUserSignedIn(async (event) => {
  const email = event.data.email?.toLowerCase();
  const adminEmails = ["runovastat@gmail.com", "kennedybenard73@gmail.com"];
  
  if (email && adminEmails.includes(email)) {
    logger.info(`Ensuring admin claim on sign-in for ${email}`);
    return { customClaims: { role: "admin" } };
  }
  return;
});

/**
 * Create user_roles document after user is created
 */
export const createUserRole = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const userId = event.params.userId;
    const userData = event.data?.data();
    
    if (!userData) return;
    
    const email = userData.email?.toLowerCase();
    const adminEmails = ["runovastat@gmail.com", "kennedybenard73@gmail.com"];
    
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
  }
);

/**
 * Score a submission using server-side ground truth access
 */
export const scoreSubmissionFunction = onCall(async (request) => {
  const {
    submissionPath,
    competitionId,
    competitionType,
    groundTruthPath,
    scoringMethod,
    idColumn,
    targetColumn,
    userId,
    userName,
    userAvatar,
  } = request.data;

  logger.info("Scoring submission:", {
    submissionPath,
    competitionId,
    competitionType,
    groundTruthPath,
    scoringMethod,
  });

  if (!submissionPath || !competitionId || !groundTruthPath) {
    throw new HttpsError("invalid-argument", "Missing required parameters");
  }

  try {
    // Get submission file from Storage
    const submissionFile = storage.bucket().file(submissionPath);
    const [submissionBuffer] = await submissionFile.download();
    const submissionText = submissionBuffer.toString("utf-8");
    const submission = parseCSV(submissionText);

    logger.info(`Parsed submission: ${submission.rowCount} rows`);

    // Get ground truth file from Storage (server-side only!)
    const groundTruthFile = storage.bucket().file(groundTruthPath);
    const [groundTruthBuffer] = await groundTruthFile.download();
    const groundTruthText = groundTruthBuffer.toString("utf-8");
    const groundTruth = parseCSV(groundTruthText);

    logger.info(`Parsed ground truth: ${groundTruth.rowCount} rows`);

    // Calculate score
    const result = scoreSubmission(
      submission,
      groundTruth,
      scoringMethod || "accuracy",
      idColumn || "id",
      targetColumn || "prediction"
    );

    logger.info("Scoring result:", result);

    // Determine collection path
    const basePath = competitionType === "playground" ? "playgrounds" : "competitions";

    // Update leaderboard if scoring was successful
    if (result.valid && userId) {
      const leaderboardRef = db.collection(`${basePath}/${competitionId}/leaderboard`).doc(userId);
      const existingEntry = await leaderboardRef.get();
      
      const currentSubmissions = existingEntry.exists ? (existingEntry.data()?.submissions || 0) : 0;
      const currentBestScore = existingEntry.exists ? (existingEntry.data()?.score || 0) : 0;
      const shouldUpdateBest = result.score > currentBestScore;

      await leaderboardRef.set({
        userId,
        userName: userName || "Anonymous",
        userAvatar: userAvatar || null,
        score: shouldUpdateBest ? result.score : currentBestScore,
        bestScore: shouldUpdateBest ? result.score : currentBestScore,
        submissions: currentSubmissions + 1,
        lastSubmission: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      logger.info(`Updated leaderboard for user ${userId}, score: ${result.score}`);
    }

    return {
      success: true,
      score: result.score,
      valid: result.valid,
      error: result.error,
      details: result.details,
    };
  } catch (error: any) {
    logger.error("Error scoring submission:", error);
    throw new HttpsError("internal", `Scoring failed: ${error.message}`);
  }
});

/**
 * Send email notification when a team invite is created
 */
export const sendTeamInviteEmail = onDocumentCreated(
  "team_invites/{inviteId}",
  async (event) => {
    const invite = event.data?.data();
    const inviteId = event.params.inviteId;

    if (!invite) {
      logger.error("No invite data found");
      return;
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      logger.warn("RESEND_API_KEY not configured, skipping email");
      return;
    }

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
              <p>Log in to your Juvana account to accept or decline this invitation.</p>
              <div style="margin: 30px 0;">
                <a href="https://juvana.lovable.app/competitions" 
                   style="background: linear-gradient(135deg, #4B0082, #6B21A8); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                  View Invitation
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                If you don't have an account yet, you'll need to sign up first using this email address.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="color: #999; font-size: 12px;">
                You received this email because someone invited you to join a team on Juvana.
              </p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error("Resend API error:", errorData);
        throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
      }

      const emailResult = await response.json();
      logger.info("Team invite email sent successfully:", emailResult);

      // Update invite to mark email as sent
      await db.collection("team_invites").doc(inviteId).update({
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    } catch (error) {
      logger.error("Error sending team invite email:", error);
    }
  }
);

/**
 * Send email notification when a new submission is scored
 */
export const onSubmissionCreated = onDocumentCreated(
  "competitions/{competitionId}/submissions/{submissionId}",
  async (event) => {
    const submission = event.data?.data();
    const competitionId = event.params.competitionId;
    const submissionId = event.params.submissionId;

    if (!submission) {
      logger.error("No submission data found");
      return;
    }

    try {
      const competitionDoc = await db.collection("competitions").doc(competitionId).get();
      const competition = competitionDoc.data();
      
      if (!competition) {
        logger.error("Competition not found");
        return;
      }

      const userDoc = await db.collection("users").doc(submission.userId).get();
      const user = userDoc.data();
      const userEmail = user?.email || submission.userEmail;

      if (!userEmail) {
        logger.warn("No email found for user");
        return;
      }

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

/**
 * Send notification when competition status changes to "active"
 */
export const onCompetitionStatusChange = onDocumentCreated(
  "competitions/{competitionId}",
  async (event) => {
    const competition = event.data?.data();
    const competitionId = event.params.competitionId;

    if (!competition || competition.status !== "active") {
      return;
    }

    logger.info("Competition started notification:", {
      competitionId,
      title: competition.title,
      message: `Competition "${competition.title}" is now active!`,
    });
  }
);