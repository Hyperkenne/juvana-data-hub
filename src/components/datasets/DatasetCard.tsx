import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const DatasetCard = ({ dataset }: any) => {
  return (
    <Link to={`/datasets/${dataset.id}`}>
      <Card className="hover:shadow-lg transition">
        <CardHeader>
          <CardTitle>{dataset.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Latest version: {dataset.latestVersion}</p>
        </CardContent>
      </Card>
    </Link>
  );
};

export default DatasetCard;
