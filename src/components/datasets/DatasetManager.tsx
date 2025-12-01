import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import DatasetCard from "./DatasetCard";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

const DatasetManager = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      const q = query(collection(db, "datasets"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setDatasets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error loading datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDatasets = datasets.filter((d: any) => {
    const search = searchQuery.toLowerCase();
    return (
      d.name?.toLowerCase().includes(search) ||
      d.description?.toLowerCase().includes(search) ||
      d.category?.toLowerCase().includes(search) ||
      d.tags?.some((tag: string) => tag.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search datasets by name, description, category, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Datasets Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? "No datasets found matching your search." : "No datasets available yet. Be the first to upload!"}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDatasets.map((d: any) => (
            <DatasetCard key={d.id} dataset={d} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DatasetManager;
