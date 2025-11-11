import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const CreateCompetition = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    prize: "",
    category: "",
    deadline: "",
    status: "upcoming" as "active" | "upcoming" | "completed",
    organizerName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const competitionData = {
        ...formData,
        deadline: new Date(formData.deadline),
        participants: 0,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "competitions"), competitionData);
      toast.success("Competition created successfully!");
      navigate(`/competition/${docRef.id}`);
    } catch (error) {
      console.error("Error creating competition:", error);
      toast.error("Failed to create competition");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Competition</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Competition Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Tanzania Housing Price Prediction"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the competition objectives and goals..."
              rows={5}
              required
              maxLength={1000}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prize">Prize *</Label>
              <Input
                id="prize"
                value={formData.prize}
                onChange={(e) => setFormData({ ...formData, prize: e.target.value })}
                placeholder="e.g., 5,000,000 TSH"
                required
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Computer Vision">Computer Vision</SelectItem>
                  <SelectItem value="NLP">Natural Language Processing</SelectItem>
                  <SelectItem value="Time Series">Time Series</SelectItem>
                  <SelectItem value="Tabular">Tabular Data</SelectItem>
                  <SelectItem value="Reinforcement Learning">Reinforcement Learning</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline *</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizer">Organizer Name *</Label>
            <Input
              id="organizer"
              value={formData.organizerName}
              onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
              placeholder="e.g., University of Dar es Salaam"
              required
              maxLength={100}
            />
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-primary to-secondary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Competition"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/admin/competitions")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateCompetition;
