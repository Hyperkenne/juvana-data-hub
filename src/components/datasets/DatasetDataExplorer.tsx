import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, ChevronLeft, ChevronRight, SortAsc, SortDesc, FileText, Columns, Hash, Type, Calendar, ToggleLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DatasetDataExplorerProps {
  files: any[];
  onSelectFile?: (file: any) => void;
}

interface ColumnInfo {
  name: string;
  type: "numeric" | "string" | "boolean" | "date" | "unknown";
  unique: number;
  missing: number;
  mean?: number;
  min?: number;
  max?: number;
  sample: string[];
}

const DatasetDataExplorer = ({ files, onSelectFile }: DatasetDataExplorerProps) => {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
  const [columnInfo, setColumnInfo] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const rowsPerPage = 20;

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
    setColumnInfo([]);
    setCurrentPage(1);
    setSortColumn(null);
    setSelectedColumn(null);
    
    try {
      const response = await fetch(file.url);
      const text = await response.text();
      const lines = text.split("\n").filter(line => line.trim());
      
      if (lines.length > 0) {
        const headers = parseCSVLine(lines[0]);
        const rows = lines.slice(1, 1001).map(line => parseCSVLine(line));
        setCsvData({ headers, rows });
        
        const info = headers.map((header, idx) => analyzeColumn(header, rows.map(r => r[idx])));
        setColumnInfo(info);
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

  const analyzeColumn = (name: string, values: (string | undefined)[]): ColumnInfo => {
    const validValues = values.filter(v => v !== undefined && v !== "" && v !== null);
    const missing = values.length - validValues.length;
    const unique = new Set(validValues).size;
    
    const numericCount = validValues.filter(v => !isNaN(parseFloat(v!))).length;
    const booleanCount = validValues.filter(v => ["true", "false", "0", "1", "yes", "no"].includes(v!.toLowerCase())).length;
    const dateCount = validValues.filter(v => !isNaN(Date.parse(v!))).length;
    
    let type: ColumnInfo["type"] = "string";
    if (numericCount > validValues.length * 0.8) type = "numeric";
    else if (booleanCount > validValues.length * 0.8) type = "boolean";
    else if (dateCount > validValues.length * 0.5 && dateCount > numericCount) type = "date";
    
    const info: ColumnInfo = { name, type, unique, missing, sample: validValues.slice(0, 5) as string[] };
    
    if (type === "numeric") {
      const nums = validValues.map(v => parseFloat(v!)).filter(n => !isNaN(n));
      if (nums.length > 0) {
        info.mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        info.min = Math.min(...nums);
        info.max = Math.max(...nums);
      }
    }
    
    return info;
  };

  const handleSort = (colIdx: number) => {
    if (sortColumn === colIdx) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(colIdx);
      setSortDirection("asc");
    }
  };

  const getTypeIcon = (type: ColumnInfo["type"]) => {
    switch (type) {
      case "numeric": return <Hash className="h-3 w-3" />;
      case "string": return <Type className="h-3 w-3" />;
      case "boolean": return <ToggleLeft className="h-3 w-3" />;
      case "date": return <Calendar className="h-3 w-3" />;
      default: return <Columns className="h-3 w-3" />;
    }
  };

  let filteredRows = csvData.rows;
  
  if (searchTerm) {
    filteredRows = filteredRows.filter(row =>
      row.some(cell => cell?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  if (sortColumn !== null) {
    filteredRows = [...filteredRows].sort((a, b) => {
      const aVal = a[sortColumn] || "";
      const bVal = b[sortColumn] || "";
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }
      return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

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

  const selectedColInfo = selectedColumn !== null ? columnInfo[selectedColumn] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {csvFiles.length > 1 && (
          <Select value={selectedFile?.name} onValueChange={(name) => {
            const file = csvFiles.find(f => f.name === name);
            if (file) handleFileSelect(file);
          }}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select file" />
            </SelectTrigger>
            <SelectContent>
              {csvFiles.map((file) => (
                <SelectItem key={file.name} value={file.name}>{file.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in data..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading data...</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-1 h-fit">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Columns ({csvData.headers.length})</span>
                <Badge variant="secondary" className="text-xs">{filteredRows.length} rows</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {columnInfo.map((col, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedColumn(selectedColumn === idx ? null : idx)}
                      className={`w-full px-4 py-2 text-left hover:bg-muted/50 transition ${selectedColumn === idx ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{getTypeIcon(col.type)}</span>
                        <span className="text-sm font-medium truncate">{col.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{col.type}</span>
                        <span>•</span>
                        <span>{col.unique} unique</span>
                        {col.missing > 0 && (<><span>•</span><span className="text-amber-500">{col.missing} missing</span></>)}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            {selectedColInfo && (
              <div className="border-b bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(selectedColInfo.type)}
                    <span className="font-medium">{selectedColInfo.name}</span>
                    <Badge variant="outline" className="text-xs">{selectedColInfo.type}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedColumn(null)}>×</Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-muted-foreground text-xs">Unique</p><p className="font-medium">{selectedColInfo.unique}</p></div>
                  <div><p className="text-muted-foreground text-xs">Missing</p><p className="font-medium">{selectedColInfo.missing}</p></div>
                  {selectedColInfo.type === "numeric" && (
                    <>
                      <div><p className="text-muted-foreground text-xs">Mean</p><p className="font-medium">{selectedColInfo.mean?.toFixed(2)}</p></div>
                      <div><p className="text-muted-foreground text-xs">Range</p><p className="font-medium">{selectedColInfo.min?.toFixed(2)} - {selectedColInfo.max?.toFixed(2)}</p></div>
                    </>
                  )}
                  {selectedColInfo.type !== "numeric" && (
                    <div className="col-span-2"><p className="text-muted-foreground text-xs">Samples</p><p className="font-medium truncate">{selectedColInfo.sample.slice(0, 3).join(", ")}</p></div>
                  )}
                </div>
              </div>
            )}

            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <div className="max-h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-14 text-center font-medium text-xs">#</TableHead>
                        {csvData.headers.map((header, idx) => (
                          <TableHead 
                            key={idx}
                            className={`cursor-pointer hover:bg-muted/50 whitespace-nowrap min-w-[100px] ${selectedColumn === idx ? "bg-primary/10" : ""}`}
                            onClick={() => handleSort(idx)}
                          >
                            <div className="flex items-center gap-1 text-xs font-medium">
                              <span className="text-muted-foreground">{getTypeIcon(columnInfo[idx]?.type || "unknown")}</span>
                              <span className="truncate max-w-[120px]">{header}</span>
                              {sortColumn === idx && (sortDirection === "asc" ? <SortAsc className="h-3 w-3 shrink-0" /> : <SortDesc className="h-3 w-3 shrink-0" />)}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRows.map((row, rowIdx) => (
                        <TableRow key={rowIdx} className="hover:bg-muted/30">
                          <TableCell className="text-center text-muted-foreground text-xs font-mono">{(currentPage - 1) * rowsPerPage + rowIdx + 1}</TableCell>
                          {csvData.headers.map((_, colIdx) => (
                            <TableCell key={colIdx} className={`max-w-[180px] truncate text-xs ${selectedColumn === colIdx ? "bg-primary/5" : ""}`}>
                              {row[colIdx] || <span className="text-muted-foreground italic">NaN</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                <p className="text-xs text-muted-foreground">{(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length}</p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-xs px-2">{currentPage} / {totalPages}</span>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default DatasetDataExplorer;
