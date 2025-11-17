/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {beforeUserCreated, beforeUserSignedIn} from "firebase-functions/v2/identity";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

admin.initializeApp();

/**
 * Automatically assign admin role to specific email addresses
 */
export const assignAdminRole = beforeUserCreated(async (event) => {
  const email = event.data.email?.toLowerCase();
  
  // List of emails that should automatically get admin access
  const adminEmails = ["runovastat@gmail.com", "kennedybenard73@gmail.com"];
  
  if (email && adminEmails.includes(email)) {
    logger.info(`Assigning admin role to ${email}`);
    
    // Set custom claims for immediate access
    return {
      customClaims: {
        role: "admin"
      }
    };
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
    
    return {
      customClaims: {
        role: "admin"
      }
    };
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
        await admin
          .firestore()
          .collection("user_roles")
          .doc(userId)
          .set({
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
 * Send email notification when a new submission is created
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
      // Get competition details
      const competitionDoc = await admin
        .firestore()
        .collection("competitions")
        .doc(competitionId)
        .get();

      const competition = competitionDoc.data();
      
      if (!competition) {
        logger.error("Competition not found");
        return;
      }

      // Get user details
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(submission.userId)
        .get();

      const user = userDoc.data();
      const userEmail = user?.email || submission.userEmail;

      if (!userEmail) {
        logger.warn("No email found for user");
        return;
      }

      // TODO: Integrate with email service (e.g., SendGrid, Mailgun, or Resend)
      // For now, we'll just log the email notification
      logger.info("Email notification for submission scored:", {
        to: userEmail,
        subject: `Your submission for ${competition.title} has been scored!`,
        body: `
          Hi ${submission.userName},
          
          Your submission for the competition "${competition.title}" has been successfully scored!
          
          Score: ${submission.score.toFixed(4)}
          Submitted at: ${submission.submittedAt.toDate().toLocaleString()}
          
          Check your leaderboard position at: https://juvana.lovable.app/competition/${competitionId}
          
          Keep competing!
          The Juvana Team
        `,
      });

      // Update submission document to mark email as sent
      await admin
        .firestore()
        .collection("competitions")
        .doc(competitionId)
        .collection("submissions")
        .doc(submissionId)
        .update({
          emailSent: true,
          emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    } catch (error) {
      logger.error("Error sending submission email:", error);
    }
  }
);

/**
 * Send email notification when competition status changes to "active"
 */
export const onCompetitionStatusChange = onDocumentCreated(
  "competitions/{competitionId}",
  async (event) => {
    const competition = event.data?.data();
    const competitionId = event.params.competitionId;

    if (!competition || competition.status !== "active") {
      return;
    }

    try {
      // Get all users who might be interested
      // In a real app, you'd have a subscription system
      logger.info("Competition started notification:", {
        competitionId,
        title: competition.title,
        message: `Competition "${competition.title}" is now active!`,
      });

      // TODO: Send emails to subscribed users
      // This would require a users collection with email preferences
    } catch (error) {
      logger.error("Error sending competition notification:", error);
    }
  }
);
