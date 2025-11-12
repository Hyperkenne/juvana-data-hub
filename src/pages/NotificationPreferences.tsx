import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Bell, Mail, Trophy, TrendingUp } from "lucide-react";
import { Navigate } from "react-router-dom";

interface NotificationSettings {
  competitionStart: boolean;
  competitionEnd: boolean;
  submissionScored: boolean;
  leaderboardUpdate: boolean;
  deadlineReminder: boolean;
}

const NotificationPreferences = () => {
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    competitionStart: true,
    competitionEnd: true,
    submissionScored: true,
    leaderboardUpdate: false,
    deadlineReminder: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;

      try {
        const docRef = doc(db, "notification_preferences", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSettings(docSnap.data() as NotificationSettings);
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      }
    };

    loadPreferences();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const docRef = doc(db, "notification_preferences", user.uid);
      await setDoc(docRef, settings);
      toast.success("Preferences saved successfully!");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="container py-12">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container max-w-2xl py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Notification Preferences</h1>
        <p className="text-muted-foreground">
          Manage how you receive updates about competitions and submissions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Choose which email notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="competitionStart" className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Competition Started
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified when a new competition becomes active
              </p>
            </div>
            <Switch
              id="competitionStart"
              checked={settings.competitionStart}
              onCheckedChange={(checked) => updateSetting("competitionStart", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="competitionEnd" className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Competition Ended
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified when a competition you're participating in ends
              </p>
            </div>
            <Switch
              id="competitionEnd"
              checked={settings.competitionEnd}
              onCheckedChange={(checked) => updateSetting("competitionEnd", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="submissionScored" className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Submission Scored
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified when your submission receives a score
              </p>
            </div>
            <Switch
              id="submissionScored"
              checked={settings.submissionScored}
              onCheckedChange={(checked) => updateSetting("submissionScored", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="leaderboardUpdate" className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Leaderboard Updates
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified about significant changes in leaderboard rankings
              </p>
            </div>
            <Switch
              id="leaderboardUpdate"
              checked={settings.leaderboardUpdate}
              onCheckedChange={(checked) => updateSetting("leaderboardUpdate", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="deadlineReminder" className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Deadline Reminders
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified 24 hours before competition deadlines
              </p>
            </div>
            <Switch
              id="deadlineReminder"
              checked={settings.deadlineReminder}
              onCheckedChange={(checked) => updateSetting("deadlineReminder", checked)}
            />
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationPreferences;
