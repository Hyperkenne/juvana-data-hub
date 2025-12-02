import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, ChevronLeft, ChevronRight, Columns, Filter, SortAsc, SortDesc, Eye, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DatasetDataExplorerProps {
  files: any[];
  onSelectFile?: (file: any) => void;
}

const DatasetDataExplorer = ({ files, onSelectFile }: DatasetDataExplorerProps) => {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const rowsPerPage = 15;

  const csvFiles = files.filter(f => f.name.toLowerCase().endsWith(".csv"));

  useEffect(() => {
    if (csvFiles.length > 0 && !selectedFile) {
      handleFileSelect(csvFiles[0]);
    }
  }, [files]);

  const handleFileSelect = async (file: any) => {
    setSelectedFile(file);
    setLoading(true);
    setCsvData({ headers: [], rows: [] });
    setCurrentPage(1);
    setSortColumn(null);
    
    try {
      const response = await fetch(file.url);
      const text = await response.text();
      const lines = text.split("\n").filter(line => line.trim());
      
      if (lines.length > 0) {
        const headers = parseCSVLine(lines[0]);
        const rows = lines.slice(1, 1001).map(line => parseCSVLine(line)); // Limit to 1000 rows
        setCsvData({ headers, rows });
      }
    } catch (error) {
      console.error("Error loading CSV:", error);
    } finally {
      setLoading(false);
    }

    onSelectFile?.(file);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getColumnStats = (colIndex: number) => {
    const values = csvData.rows.map(row => row[colIndex]).filter(v => v !== undefined && v !== "");
    const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
    
    if (numericValues.length > values.length * 0.5) {
      // Numeric column
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const mean = sum / numericValues.length;
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      return { type: "numeric", mean: mean.toFixed(2), min, max, unique: new Set(values).size };
    }
    
    return { type: "string", unique: new Set(values).size, missing: csvData.rows.length - values.length };
  };

  // Filter and sort data
  let filteredRows = csvData.rows;
  
  if (searchTerm) {
    filteredRows = filteredRows.filter(row =>
      row.some(cell => cell.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  if (sortColumn) {
    const colIndex = csvData.headers.indexOf(sortColumn);
    if (colIndex !== -1) {
      filteredRows = [...filteredRows].sort((a, b) => {
        const aVal = a[colIndex] || "";
        const bVal = b[colIndex] || "";
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      });
    }
  }

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  if (csvFiles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No CSV files available to explore</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Data Explorer
          </CardTitle>
          <Badge variant="secondary">
            {filteredRows.length.toLocaleString()} rows × {csvData.headers.length} columns
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File selector tabs */}
        {csvFiles.length > 1 && (
          <Tabs value={selectedFile?.name} onValueChange={(name) => {
            const file = csvFiles.find(f => f.name === name);
            if (file) handleFileSelect(file);
          }}>
            <TabsList className="h-auto flex-wrap">
              {csvFiles.map((file) => (
                <TabsTrigger key={file.name} value={file.name} className="text-xs">
                  {file.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Search and controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search data..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Badge variant="outline" className="shrink-0">
            <Columns className="h-3 w-3 mr-1" />
            {csvData.headers.length} cols
          </Badge>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            Loading data...
          </div>
        ) : (
          <>
            {/* Column stats summary */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {csvData.headers.slice(0, 6).map((header, idx) => {
                const stats = getColumnStats(idx);
                return (
                  <div key={header} className="shrink-0 p-2 rounded-lg bg-muted/50 text-xs min-w-[120px]">
                    <p className="font-medium truncate">{header}</p>
                    <p className="text-muted-foreground">
                      {stats.type === "numeric" 
                        ? `μ=${stats.mean}` 
                        : `${stats.unique} unique`}
                    </p>
                  </div>
                );
              })}
              {csvData.headers.length > 6 && (
                <div className="shrink-0 p-2 rounded-lg bg-muted/30 text-xs min-w-[80px] flex items-center justify-center text-muted-foreground">
                  +{csvData.headers.length - 6} more
                </div>
              )}
            </div>

            {/* Data table */}
            <ScrollArea className="rounded-md border">
              <div className="max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      {csvData.headers.map((header, idx) => (
                        <TableHead 
                          key={idx}
                          className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                          onClick={() => handleSort(header)}
                        >
                          <div className="flex items-center gap-1">
                            {header}
                            {sortColumn === header && (
                              sortDirection === "asc" 
                                ? <SortAsc className="h-3 w-3" />
                                : <SortDesc className="h-3 w-3" />
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((row, rowIdx) => (
                      <TableRow key={rowIdx} className="hover:bg-muted/30">
                        <TableCell className="text-center text-muted-foreground text-xs">
                          {(currentPage - 1) * rowsPerPage + rowIdx + 1}
                        </TableCell>
                        {csvData.headers.map((_, colIdx) => (
                          <TableCell key={colIdx} className="max-w-[200px] truncate">
                            {row[colIdx] || <span className="text-muted-foreground italic">null</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DatasetDataExplorer;