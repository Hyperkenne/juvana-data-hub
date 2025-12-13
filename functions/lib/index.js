"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onCompetitionStatusChange = exports.onSubmissionCreated = exports.sendTeamInviteEmailManual = exports.sendTeamInviteEmail = exports.scoreSubmissionFunction = exports.createUserRole = void 0;
// functions/src/index.ts
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const cors = require("cors");
const scoring_1 = require("./scoring");
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
// Initialize CORS middleware
const corsHandler = cors({ origin: true });
// -------------------- USER/ADMIN TRIGGERS --------------------
const adminEmails = ["runovastat@gmail.com", "kennedybenard73@gmail.com"];
exports.createUserRole = (0, firestore_1.onDocumentCreated)("users/{userId}", async (event) => {
    var _a, _b;
    const userId = event.params.userId;
    const userData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!userData)
        return;
    const email = (_b = userData.email) === null || _b === void 0 ? void 0 : _b.toLowerCase();
    if (email && adminEmails.includes(email)) {
        try {
            await db.collection("user_roles").doc(userId).set({
                roles: ["admin", "organizer"],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            logger.info(`Created admin role document for ${email}`);
        }
        catch (error) {
            logger.error("Error creating user role:", error);
        }
    }
});
const scoreSubmissionHandler = async (payload) => {
    var _a, _b;
    const { submissionPath, groundTruthPath, competitionId, competitionType, scoringMethod, idColumn, targetColumn, userId, userName, userAvatar, } = payload;
    if (!submissionPath || !competitionId || !groundTruthPath) {
        throw new https_1.HttpsError("invalid-argument", "Missing required parameters: submissionPath, competitionId, or groundTruthPath");
    }
    try {
        // Download submission CSV
        const submissionFile = storage.bucket().file(submissionPath);
        const [submissionBuffer] = await submissionFile.download();
        const submissionText = submissionBuffer.toString("utf-8");
        const submission = (0, scoring_1.parseCSV)(submissionText);
        logger.info(`Parsed submission: ${submission.rowCount} rows`);
        // Download ground truth CSV
        const groundTruthFile = storage.bucket().file(groundTruthPath);
        const [groundTruthBuffer] = await groundTruthFile.download();
        const groundTruthText = groundTruthBuffer.toString("utf-8");
        const groundTruth = (0, scoring_1.parseCSV)(groundTruthText);
        logger.info(`Parsed ground truth: ${groundTruth.rowCount} rows`);
        // Basic validation
        const idCol = (idColumn || "id").toLowerCase();
        const targetCol = (targetColumn || "prediction").toLowerCase();
        if (!submission.headers.includes(idCol) &&
            !submission.headers.includes(targetCol) &&
            !groundTruth.headers.includes(targetCol)) {
            logger.warn("Submission/ground truth missing expected columns", {
                idCol,
                targetCol,
                submissionHeaders: submission.headers,
                gtHeaders: groundTruth.headers,
            });
        }
        // Compute score
        const result = (0, scoring_1.scoreSubmission)(submission, groundTruth, scoringMethod || "accuracy", idColumn || "id", targetColumn || "prediction");
        logger.info("Scoring result:", result);
        // Update leaderboard
        const basePath = competitionType === "playground" ? "playgrounds" : "competitions";
        if (result.valid && userId) {
            const leaderboardRef = db.collection(`${basePath}/${competitionId}/leaderboard`).doc(userId);
            const existingEntry = await leaderboardRef.get();
            const currentSubmissions = existingEntry.exists ? ((_a = existingEntry.data()) === null || _a === void 0 ? void 0 : _a.submissions) || 0 : 0;
            const currentBestScore = existingEntry.exists ? ((_b = existingEntry.data()) === null || _b === void 0 ? void 0 : _b.bestScore) || 0 : 0;
            const shouldUpdateBest = result.score > currentBestScore;
            await leaderboardRef.set({
                userId,
                userName: userName || "Anonymous",
                userAvatar: userAvatar || null,
                score: result.score,
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
            error: result.error || null,
            details: result.details || null,
        };
    }
    catch (error) {
        logger.error("Error scoring submission:", error);
        throw new https_1.HttpsError("internal", `Scoring failed: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
    }
};
// -------------------- HTTP FUNCTION WITH CORS --------------------
exports.scoreSubmissionFunction = functions.https.onRequest(async (req, res) => {
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
            let payload;
            // Handle different content types
            if (typeof req.body === "string") {
                try {
                    payload = JSON.parse(req.body);
                }
                catch (parseError) {
                    logger.error("Failed to parse JSON body:", parseError);
                    return res.status(400).json({
                        success: false,
                        error: "Invalid JSON format in request body"
                    });
                }
            }
            else {
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
            const missingFields = requiredFields.filter(field => !payload[field]);
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
        }
        catch (error) {
            logger.error("❌ Error in scoreSubmissionFunction:", error);
            // Format error response
            const errorResponse = {
                success: false,
                error: (error === null || error === void 0 ? void 0 : error.message) || "Internal server error",
                timestamp: new Date().toISOString()
            };
            // Handle specific error types
            if (error instanceof https_1.HttpsError) {
                return res.status(400).json(Object.assign(Object.assign({}, errorResponse), { code: error.code }));
            }
            // Generic server error
            return res.status(500).json(errorResponse);
        }
    });
});
// -------------------- EMAIL/TRIGGER FUNCTIONS --------------------
// Option 1: Auto-triggered when invite is created (recommended)
exports.sendTeamInviteEmail = (0, firestore_1.onDocumentCreated)("team_invites/{inviteId}", async (event) => {
    var _a;
    const invite = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const inviteId = event.params.inviteId;
    if (!invite) {
        logger.error("No invite data found for ID:", inviteId);
        return;
    }
    logger.info("📧 Processing team invite email for:", {
        inviteId,
        teamName: invite.teamName,
        invitedEmail: invite.invitedEmail,
        invitedByName: invite.invitedByName
    });
    // Check for Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        logger.warn("❌ RESEND_API_KEY not found in environment variables");
        logger.warn("Configure using: firebase functions:config:set resend.api_key=\"your_key_here\"");
        try {
            await db.collection("team_invites").doc(inviteId).update({
                emailError: "RESEND_API_KEY not configured",
                emailSent: false,
                lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch (updateError) {
            logger.error("Failed to update invite with error:", updateError);
        }
        return;
    }
    try {
        // Prepare email HTML
        const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4B0082, #6B21A8); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #4B0082, #6B21A8); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏆 Team Invitation</h1>
        </div>
        <div class="content">
          <p>Hi there!</p>
          <p><strong>${invite.invitedByName}</strong> has invited you to join their team:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 24px; font-weight: bold; color: #4B0082; margin: 10px 0;">"${invite.teamName}"</div>
            <p>For a competition on <strong>Juvana Data Hub</strong></p>
          </div>
          <div style="text-align: center;">
            <a href="https://juvana.lovable.app/competitions/${invite.competitionId}" class="button">
              View Invitation & Accept
            </a>
          </div>
          <p>To accept this invitation:</p>
          <ol>
            <li>Log in to your Juvana account</li>
            <li>Go to the competition page</li>
            <li>Look for "Pending Invitations" in the Teams section</li>
            <li>Click "Accept" to join the team</li>
          </ol>
          <p>If you don't have an account yet, you'll need to create one first.</p>
        </div>
        <div class="footer">
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          <p>© ${new Date().getFullYear()} Juvana Data Hub. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
        logger.info("📤 Sending email via Resend API to:", invite.invitedEmail);
        // Send email using Resend API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                from: "Juvana Data Hub <noreply@resend.dev>",
                to: [invite.invitedEmail],
                subject: `🎯 You're invited to join team "${invite.teamName}" on Juvana!`,
                html: emailHtml,
                tags: [
                    { name: "category", value: "team_invite" },
                    { name: "competition_id", value: invite.competitionId }
                ]
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            }
            catch (e) {
                errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
            }
            logger.error("❌ Resend API error response:", {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
        }
        const result = await response.json();
        logger.info("✅ Email sent successfully:", result);
        // Update invite document with success
        await db.collection("team_invites").doc(inviteId).update({
            emailSent: true,
            emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            emailId: result.id || null,
            lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info("📝 Updated invite document with email sent status");
    }
    catch (error) {
        logger.error("❌ Error sending team invite email:", {
            error: error.message,
            stack: error.stack,
            inviteId,
            invitedEmail: invite.invitedEmail
        });
        // Update invite with error details
        try {
            await db.collection("team_invites").doc(inviteId).update({
                emailSent: false,
                emailError: error.message || "Unknown error",
                lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
                errorDetails: error.toString(),
            });
        }
        catch (updateError) {
            logger.error("Failed to update invite with error status:", updateError);
        }
    }
});
// Option 2: Callable function for manual triggering (backup option)
exports.sendTeamInviteEmailManual = (0, https_1.onCall)(async (request) => {
    const { inviteId, teamName, invitedEmail, invitedByName, competitionId } = request.data;
    if (!inviteId || !teamName || !invitedEmail || !invitedByName || !competitionId) {
        throw new https_1.HttpsError("invalid-argument", "Missing required invitation data");
    }
    logger.info("📧 Manual email trigger for:", { inviteId, invitedEmail });
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        throw new https_1.HttpsError("failed-precondition", "RESEND_API_KEY not configured");
    }
    try {
        const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4B0082;">Team Invitation</h1>
        <p>Hi there!</p>
        <p><strong>${invitedByName}</strong> has invited you to join their team <strong>"${teamName}"</strong> for a competition on Juvana.</p>
        <div style="margin: 30px 0;">
          <a href="https://juvana.lovable.app/competitions/${competitionId}"
             style="background: linear-gradient(135deg, #4B0082, #6B21A8); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            View Invitation
          </a>
        </div>
      </div>
    `;
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Juvana <noreply@resend.dev>",
                to: [invitedEmail],
                subject: `You're invited to join team "${teamName}" on Juvana!`,
                html: emailHtml,
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
        return { success: true, message: "Email sent successfully" };
    }
    catch (error) {
        logger.error("Error sending team invite email:", error);
        throw new https_1.HttpsError("internal", `Failed to send email: ${error.message}`);
    }
});
exports.onSubmissionCreated = (0, firestore_1.onDocumentCreated)("competitions/{competitionId}/submissions/{submissionId}", async (event) => {
    var _a;
    const submission = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const competitionId = event.params.competitionId;
    const submissionId = event.params.submissionId;
    if (!submission)
        return logger.error("No submission data found");
    try {
        const competitionDoc = await db.collection("competitions").doc(competitionId).get();
        const competition = competitionDoc.data();
        if (!competition)
            return logger.error("Competition not found");
        const userDoc = await db.collection("users").doc(submission.userId).get();
        const user = userDoc.data();
        const userEmail = (user === null || user === void 0 ? void 0 : user.email) || submission.userEmail;
        if (!userEmail)
            return logger.warn("No email found for user");
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
    }
    catch (error) {
        logger.error("Error sending submission email:", error);
    }
});
exports.onCompetitionStatusChange = (0, firestore_1.onDocumentCreated)("competitions/{competitionId}", async (event) => {
    var _a;
    const competition = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const competitionId = event.params.competitionId;
    if (!competition || competition.status !== "active")
        return;
    logger.info("Competition started notification:", {
        competitionId,
        title: competition.title,
        message: `Competition "${competition.title}" is now active!`,
    });
});
//# sourceMappingURL=index.js.map