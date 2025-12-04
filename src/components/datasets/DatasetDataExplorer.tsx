import { useState, useEffect } from "react";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import {
  Card, CardHeader, CardTitle, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Search, ChevronLeft, ChevronRight, SortAsc, SortDesc,
  FileText, Columns, Hash, Type, Calendar, ToggleLeft,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface DatasetDataExplorerProps {
  files: any[]; // [{ name, file?: File, url?: string }]
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
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] }>({
    headers: [],
    rows: [],
  });
  const [columnInfo, setColumnInfo] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const rowsPerPage = 20;

  // Filter only CSV files
  const csvFiles = files.filter(f =>
    f.name.toLowerCase().endsWith(".csv") ||
    f.file?.name?.toLowerCase().endsWith(".csv") ||
    f.url?.toLowerCase().endsWith(".csv")
  );

  useEffect(() => {
    if (csvFiles.length > 0 && !selectedFile) {
      handleFileSelect(csvFiles[0]);
    }
  }, [files]);

  // --- HANDLE FILE SELECTION (Local or Firebase) ---
  const handleFileSelect = async (fileObj: any) => {
    setSelectedFile(fileObj);
    setLoading(true);
    setCsvData({ headers: [], rows: [] });
    setColumnInfo([]);

    try {
      let text: string | null = null;

      // Local file
      if (fileObj.file instanceof File) {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject("Error reading CSV file.");
          reader.readAsText(fileObj.file);
        });
      } 
      // Firebase URL
      else if (fileObj.url) {
        const storage = getStorage();
        const fileRef = ref(storage, fileObj.url);
        const downloadURL = await getDownloadURL(fileRef);

        const res = await fetch(downloadURL);
        if (!res.ok) throw new Error("Failed to fetch file from Firebase.");
        text = await res.text();
      }

      if (!text) throw new Error("No CSV content found.");

      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length === 0) {
        setLoading(false);
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1, 2000).map(l => parseCSVLine(l));

      setCsvData({ headers, rows });
      const info = headers.map((header, idx) =>
        analyzeColumn(header, rows.map(r => r[idx]))
      );
      setColumnInfo(info);
    } catch (err: any) {
      console.error("Error loading CSV:", err);
      setCsvData({ headers: [], rows: [] });
      setColumnInfo([]);
    } finally {
      setLoading(false);
      onSelectFile?.(fileObj);
    }
  };

  // --- CSV PARSER ---
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // --- ANALYZE COLUMN ---
  const analyzeColumn = (name: string, values: (string | undefined)[]): ColumnInfo => {
    const valid = values.filter(v => v !== undefined && v !== "");
    const missing = values.length - valid.length;
    const unique = new Set(valid).size;

    const numericCount = valid.filter(v => !isNaN(parseFloat(v!))).length;
    const booleanCount = valid.filter(v =>
      ["true", "false", "0", "1", "yes", "no"].includes(v!.toLowerCase())
    ).length;
    const dateCount = valid.filter(v => !isNaN(Date.parse(v!))).length;

    let type: ColumnInfo["type"] = "string";
    if (numericCount > valid.length * 0.8) type = "numeric";
    else if (booleanCount > valid.length * 0.8) type = "boolean";
    else if (dateCount > valid.length * 0.5) type = "date";

    const info: ColumnInfo = {
      name,
      type,
      unique,
      missing,
      sample: valid.slice(0, 5) as string[],
    };

    if (type === "numeric") {
      const nums = valid.map(v => parseFloat(v!)).filter(x => !isNaN(x));
      if (nums.length) {
        info.mean = nums.reduce((a, b) => a + b) / nums.length;
        info.min = Math.min(...nums);
        info.max = Math.max(...nums);
      }
    }

    return info;
  };

  // --- SORTING ---
  const handleSort = (colIdx: number) => {
    if (sortColumn === colIdx) setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    else {
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

  // --- FILTER & SORT ---
  let filteredRows = csvData.rows;
  if (searchTerm) {
    filteredRows = filteredRows.filter(row =>
      row.some(val => val?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }
  if (sortColumn !== null) {
    filteredRows = [...filteredRows].sort((a, b) => {
      const aVal = a[sortColumn] || "";
      const bVal = b[sortColumn] || "";

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  if (!csvFiles.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No CSV files uploaded</p>
        </CardContent>
      </Card>
    );
  }

  const selectedColInfo = selectedColumn !== null ? columnInfo[selectedColumn] : null;

  return (
    <div className="space-y-4">
      {/* SELECT FILE + SEARCH */}
      <div className="flex flex-col sm:flex-row gap-3">
        {csvFiles.length > 1 && (
          <Select
            value={selectedFile?.name}
            onValueChange={name => {
              const file = csvFiles.find(f => f.name === name);
              if (file) handleFileSelect(file);
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select file" />
            </SelectTrigger>
            <SelectContent>
              {csvFiles.map(f => (
                <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in data..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      {/* MAIN LAYOUT */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Loading CSV...</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* SIDEBAR */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex justify-between">
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
                      className={`w-full px-4 py-2 text-left hover:bg-muted/50 ${selectedColumn === idx ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{getTypeIcon(col.type)}</span>
                        <span className="text-sm truncate">{col.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex gap-1">
                        <span>{col.type}</span>•<span>{col.unique} unique</span>
                        {col.missing > 0 && (
                          <>•<span className="text-amber-500">{col.missing} missing</span></>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* DATA TABLE */}
          <Card className="lg:col-span-3">
            {selectedColInfo && (
              <div className="border-b bg-muted/30 px-4 py-3">
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(selectedColInfo.type)}
                    <span>{selectedColInfo.name}</span>
                    <Badge variant="outline">{selectedColInfo.type}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedColumn(null)}>×</Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mt-3">
                  <div><p className="text-xs text-muted-foreground">Unique</p><p>{selectedColInfo.unique}</p></div>
                  <div><p className="text-xs text-muted-foreground">Missing</p><p>{selectedColInfo.missing}</p></div>
                  {selectedColInfo.type === "numeric" ? (
                    <>
                      <div><p className="text-xs text-muted-foreground">Mean</p><p>{selectedColInfo.mean?.toFixed(2)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Range</p><p>{selectedColInfo.min} - {selectedColInfo.max}</p></div>
                    </>
                  ) : (
                    <div className="col-span-2"><p className="text-xs text-muted-foreground">Samples</p><p>{selectedColInfo.sample.join(", ")}</p></div>
                  )}
                </div>
              </div>
            )}
            <CardContent className="p-0">
              <ScrollArea>
                <div className="max-h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-14 text-center text-xs">#</TableHead>
                        {csvData.headers.map((header, idx) => (
                          <TableHead
                            key={idx}
                            className="cursor-pointer hover:bg-muted/50 min-w-[120px]"
                            onClick={() => handleSort(idx)}
                          >
                            <div className="flex items-center gap-1 text-xs">
                              {getTypeIcon(columnInfo[idx]?.type || "unknown")}
                              <span>{header}</span>
                              {sortColumn === idx && (sortDirection === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRows.map((row, rIdx) => (
                        <TableRow key={rIdx}>
                          <TableCell className="text-center text-xs">{(currentPage - 1) * rowsPerPage + rIdx + 1}</TableCell>
                          {csvData.headers.map((_, cIdx) => (
                            <TableCell key={cIdx} className="text-xs truncate">{row[cIdx] || <span className="text-muted">NaN</span>}</TableCell>
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
              <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  {(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-xs">{currentPage} / {totalPages}</span>
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
