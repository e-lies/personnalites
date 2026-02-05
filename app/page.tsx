"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface ColumnInfo {
  name: string;
  selected: boolean;
}

interface DuplicateInfo {
  original: string;
  duplicate: string;
  originalIndex: number;
  duplicateIndex: number;
  score?: number;
}

type ComparisonMode = "exact" | "fuzzy";
type SimilarityAlgorithm = "dice" | "jaro-winkler" | "levenshtein";
type SortColumn = "original" | "duplicate" | "score";
type SortDirection = "asc" | "desc";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [workbookData, setWorkbookData] = useState<XLSX.WorkBook | null>(null);
  const [result, setResult] = useState<any[] | null>(null);
  const [duplicatesFound, setDuplicatesFound] = useState<DuplicateInfo[]>([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<number>>(new Set());
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("fuzzy");
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);
  const [similarityAlgorithm, setSimilarityAlgorithm] = useState<SimilarityAlgorithm>("jaro-winkler");
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sliceStart, setSliceStart] = useState<number>(0);
  const [sliceEnd, setSliceEnd] = useState<number | undefined>(undefined);
  const [totalRows, setTotalRows] = useState<number>(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        setWorkbookData(workbook);
        setSheets(workbook.SheetNames);
        setSelectedSheet("");
        setColumns([]);
        setResult(null);
        setDuplicatesFound([]);
        setSelectedDuplicates(new Set());
        setOriginalData([]);
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);
    setResult(null);

    if (workbookData && sheetName) {
      const worksheet = workbookData.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        const headers = jsonData[0] as string[];
        const columnList = headers.map((header) => ({
          name: header,
          selected: false,
        }));
        setColumns(columnList);
        // Set total rows (excluding header row)
        setTotalRows(jsonData.length - 1);
        // Reset slice to defaults
        setSliceStart(0);
        setSliceEnd(jsonData.length - 1);
      }
    }
  };

  const handleColumnToggle = (index: number) => {
    const updatedColumns = [...columns];
    updatedColumns[index].selected = !updatedColumns[index].selected;
    setColumns(updatedColumns);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workbookData || !selectedSheet) {
      alert("Please select a file and sheet");
      return;
    }

    const selectedColumns = columns
      .filter((col) => col.selected)
      .map((col) => col.name);

    if (selectedColumns.length === 0) {
      alert("Please select at least one column");
      return;
    }

    setLoading(true);

    try {
      const worksheet = workbookData.Sheets[selectedSheet];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setOriginalData(jsonData);
      setTotalRows(jsonData.length);
      setSelectedDuplicates(new Set());

      const response = await fetch("/api/process-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: jsonData,
          columns: selectedColumns,
          comparisonMode,
          similarityThreshold,
          similarityAlgorithm,
          sliceStart,
          sliceEnd,
        }),
      });

      const result = await response.json();
      setResult(result.uniqueRows);
      setDuplicatesFound(result.duplicatesFound || []);
      // Select all duplicates by default
      const allDuplicateIndexes = new Set<number>(
        (result.duplicatesFound || []).map((_: DuplicateInfo, idx: number) => idx)
      );
      setSelectedDuplicates(allDuplicateIndexes);
    } catch (error) {
      console.error("Error processing data:", error);
      alert("Error processing data");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateToggle = (index: number) => {
    const newSelected = new Set(selectedDuplicates);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedDuplicates(newSelected);
  };

  const handleSelectAllDuplicates = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedDuplicates(new Set(duplicatesFound.map((_, idx) => idx)));
    } else {
      setSelectedDuplicates(new Set());
    }
  };

  const handleExport = () => {
    if (!originalData.length || !workbookData || !selectedSheet) return;

    // Get the sliced data that was actually processed
    const endIndex = sliceEnd ?? originalData.length;
    const slicedData = originalData.slice(sliceStart, endIndex);

    // Get the indexes of duplicates to remove (only selected ones)
    // Note: duplicateIndex is relative to the sliced data, so we use it directly
    const indexesToRemove = new Set<number>();
    duplicatesFound.forEach((dup, idx) => {
      if (selectedDuplicates.has(idx)) {
        indexesToRemove.add(dup.duplicateIndex);
      }
    });

    // Filter out the selected duplicate rows from the sliced data
    const filteredData = slicedData.filter((_, index) => !indexesToRemove.has(index));

    // Create a new workbook with the filtered data
    const newWorkbook = XLSX.utils.book_new();
    const newWorksheet = XLSX.utils.json_to_sheet(filteredData);
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, selectedSheet);

    // Generate filename
    const originalFileName = file?.name?.replace(/\.[^/.]+$/, "") || "export";
    const exportFileName = `${originalFileName}_deduplicated.xlsx`;

    // Download the file
    XLSX.writeFile(newWorkbook, exportFileName);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return " ↕";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  // Create sorted duplicates with original array indexes preserved
  const sortedDuplicates = [...duplicatesFound]
    .map((dup, arrayIndex) => ({ ...dup, arrayIndex }))
    .sort((a, b) => {
      if (!sortColumn) return 0;
      
      let comparison = 0;
      switch (sortColumn) {
        case "original":
          comparison = a.original.localeCompare(b.original);
          break;
        case "duplicate":
          comparison = a.duplicate.localeCompare(b.duplicate);
          break;
        case "score":
          comparison = (a.score ?? 0) - (b.score ?? 0);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Doublons feuille Excel
        </h1>

        <div className="flex flex-col lg:flex-row lg:gap-6">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6 lg:mb-0 lg:min-w-[400px] lg:max-w-[50%] lg:shrink-0 lg:sticky lg:top-6 lg:self-start">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload du fichier Excel
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>

            {/* Sheet Selection */}
            {sheets.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Choisir une feuille
                </label>
                <select
                  value={selectedSheet}
                  onChange={handleSheetChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Select a sheet --</option>
                  {sheets.map((sheet) => (
                    <option key={sheet} value={sheet}>
                      {sheet}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Column Selection */}
            {columns.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Colonnes à rendre uniques
                </label>
                <div className="border border-gray-300 rounded-md p-4 max-h-60 overflow-y-auto">
                  {columns.map((column, index) => (
                    <div key={index} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={`column-${index}`}
                        checked={column.selected}
                        onChange={() => handleColumnToggle(index)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor={`column-${index}`}
                        className="ml-2 text-sm text-gray-700"
                      >
                        {column.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comparison Mode */}
            {columns.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mode de comparaison
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="comparisonMode"
                      value="exact"
                      checked={comparisonMode === "exact"}
                      onChange={(e) => setComparisonMode(e.target.value as ComparisonMode)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Exact (doublons identiques)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="comparisonMode"
                      value="fuzzy"
                      checked={comparisonMode === "fuzzy"}
                      onChange={(e) => setComparisonMode(e.target.value as ComparisonMode)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Similaire (valeurs proches)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Similarity Threshold (only shown in fuzzy mode) */}
            {columns.length > 0 && comparisonMode === "fuzzy" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Algorithme de similarité
                </label>
                <select
                  value={similarityAlgorithm}
                  onChange={(e) => setSimilarityAlgorithm(e.target.value as SimilarityAlgorithm)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="jaro-winkler">Jaro-Winkler (recommandé pour les noms)</option>
                  <option value="dice">Dice coefficient</option>
                  <option value="levenshtein">Levenshtein (détection de fautes)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {similarityAlgorithm === "jaro-winkler" && "Privilégie les correspondances de préfixes (idéal pour les noms)"}
                  {similarityAlgorithm === "dice" && "Compare les bigrammes de caractères"}
                  {similarityAlgorithm === "levenshtein" && "Compte les modifications nécessaires (insertion/suppression/remplacement)"}
                </p>
              </div>
            )}

            {/* Similarity Threshold Slider */}
            {columns.length > 0 && comparisonMode === "fuzzy" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seuil de similarité: {(similarityThreshold * 100).toFixed(0)}%
                  <span className="text-gray-500 text-xs ml-2">
                    (plus élevé = plus strict)
                  </span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.01"
                  value={similarityThreshold}
                  onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Permissif (50%)</span>
                  <span>Strict (100%)</span>
                </div>
              </div>
            )}

            {/* Row Range Selection */}
            {columns.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plage de lignes à traiter
                  {totalRows > 0 && (
                    <span className="text-gray-500 text-xs ml-2">
                      ({totalRows} lignes dans le fichier)
                    </span>
                  )}
                </label>
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Début</label>
                    <input
                      type="number"
                      min="0"
                      max={totalRows > 0 ? totalRows - 1 : undefined}
                      value={sliceStart}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const maxStart = totalRows > 0 ? totalRows - 1 : val;
                        setSliceStart(Math.max(0, Math.min(val, maxStart)));
                      }}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Fin (vide = toutes)</label>
                    <input
                      type="number"
                      min="1"
                      max={totalRows > 0 ? totalRows : undefined}
                      value={sliceEnd ?? ""}
                      placeholder="Toutes"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setSliceEnd(undefined);
                        } else {
                          const num = parseInt(val) || 1;
                          const maxEnd = totalRows > 0 ? totalRows : num;
                          setSliceEnd(Math.max(1, Math.min(num, maxEnd)));
                        }
                      }}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Lignes {sliceStart + 1} à {sliceEnd ?? (totalRows || "fin")} seront traitées
                </p>
              </div>
            )}

            {/* Performance Warning */}
            {columns.length > 0 && (() => {
              const rowCount = (sliceEnd ?? totalRows) - sliceStart;
              let warningThreshold: number;
              let algorithmName: string;
              
              if (comparisonMode === "exact") {
                warningThreshold = 1000000;
                algorithmName = "doublons exacts";
              } else if (similarityAlgorithm === "levenshtein") {
                warningThreshold = 4000;
                algorithmName = "Levenshtein";
              } else if (similarityAlgorithm === "dice") {
                warningThreshold = 6000;
                algorithmName = "Dice";
              } else {
                warningThreshold = 12000;
                algorithmName = "Jaro-Winkler";
              }
              
              if (rowCount > warningThreshold) {
                return (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <div className="flex items-start">
                      <span className="text-yellow-600 mr-2">⚠️</span>
                      <div className="text-sm text-yellow-700">
                        <strong>Attention :</strong> Vous allez traiter {rowCount.toLocaleString()} lignes avec l&apos;algorithme {algorithmName}. 
                        Au-delà de {warningThreshold.toLocaleString()} lignes, le traitement peut être lent.
                        Envisagez de réduire la plage de lignes.
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Submit Button */}
            {columns.length > 0 && (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "En cours de traitement..." : "Traiter le fichier"}
              </button>
            )}
          </form>
          </div>

          <div className="flex-1 flex flex-col gap-6 lg:min-w-[50%]">
        {/* Results Display */}
        {result && (
          <div className="bg-white shadow-md rounded-lg p-6 flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Liens ISNI ({result.length} lignes uniques)
            </h2>
            <div className="overflow-auto max-h-96">
              <pre id="results" className="bg-gray-100 p-4 rounded-md text-sm min-h-full">
                {result.map((row, index) => {
                  const match = row.isni.match(/href=([^>]+)>(.*?)<\/a>/);
                  const href = match ? match[1] : "#";
                  const text = match ? match[2] : "Link";
                  
                  return (
                    <div key={index}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {text}
                      </a>
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        )}

        {/* Duplicates Found Display */}
        {duplicatesFound.length > 0 && (
          <div className="bg-white shadow-md rounded-lg p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                Valeurs similaires trouvées ({duplicatesFound.length})
              </h2>
              <div className="flex gap-2">
                <span className="text-sm text-gray-500 self-center">
                  {selectedDuplicates.size} sélectionné(s)
                </span>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={originalData.length === 0}
                  className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  Exporter les données filtrées
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-grow">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      <input
                        type="checkbox"
                        checked={selectedDuplicates.size === duplicatesFound.length}
                        onChange={(e) => handleSelectAllDuplicates(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th 
                      className="px-4 py-2 text-left font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("original")}
                    >
                      Original (ligne){getSortIcon("original")}
                    </th>
                    <th 
                      className="px-4 py-2 text-left font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("duplicate")}
                    >
                      Doublon (ligne){getSortIcon("duplicate")}
                    </th>
                    {comparisonMode === "fuzzy" && (
                      <th 
                        className="px-4 py-2 text-left font-medium text-gray-500 cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort("score")}
                      >
                        Score{getSortIcon("score")}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDuplicates.map((dup) => (
                    <tr key={dup.arrayIndex} className={`hover:bg-gray-50 ${selectedDuplicates.has(dup.arrayIndex) ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedDuplicates.has(dup.arrayIndex)}
                          onChange={() => handleDuplicateToggle(dup.arrayIndex)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {dup.original}
                        <span className="text-gray-400 text-xs ml-1">(#{dup.originalIndex + 2})</span>
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {dup.duplicate}
                        <span className="text-gray-400 text-xs ml-1">(#{dup.duplicateIndex + 2})</span>
                      </td>
                      {comparisonMode === "fuzzy" && (
                        <td className="px-4 py-2 text-gray-500">
                          {dup.score !== undefined ? (dup.score * 100).toFixed(1) + "%" : "-"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
