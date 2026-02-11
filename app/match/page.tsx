"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface ColumnInfo {
  name: string;
  selected: boolean;
}

interface MatchResult {
  file1RowIndex: number;
  file2RowIndex: number | null;
  file1Value: string;
  file2Value: string | null;
  score: number;
  file1AdditionalData: Record<string, any>;
  file2AdditionalData: Record<string, any>;
}

type SimilarityAlgorithm = "dice" | "jaro-winkler" | "levenshtein";

export default function MatchPage() {
  // File 1 state
  const [file1, setFile1] = useState<File | null>(null);
  const [file1Workbook, setFile1Workbook] = useState<XLSX.WorkBook | null>(null);
  const [file1Sheets, setFile1Sheets] = useState<string[]>([]);
  const [file1SelectedSheet, setFile1SelectedSheet] = useState<string>("");
  const [file1Columns, setFile1Columns] = useState<string[]>([]);
  const [file1SelectedColumn, setFile1SelectedColumn] = useState<string>("");
  const [file1AdditionalColumns, setFile1AdditionalColumns] = useState<ColumnInfo[]>([]);

  // File 2 state
  const [file2, setFile2] = useState<File | null>(null);
  const [file2Workbook, setFile2Workbook] = useState<XLSX.WorkBook | null>(null);
  const [file2Sheets, setFile2Sheets] = useState<string[]>([]);
  const [file2SelectedSheet, setFile2SelectedSheet] = useState<string>("");
  const [file2Columns, setFile2Columns] = useState<string[]>([]);
  const [file2SelectedColumn, setFile2SelectedColumn] = useState<string>("");
  const [file2AdditionalColumns, setFile2AdditionalColumns] = useState<ColumnInfo[]>([]);

  // Matching settings
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);
  const [similarityAlgorithm, setSimilarityAlgorithm] = useState<SimilarityAlgorithm>("jaro-winkler");

  // Results
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalFile1Rows: number;
    totalFile2Rows: number;
    matchedCount: number;
    unmatchedCount: number;
  } | null>(null);

  const handleFile1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile1(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        setFile1Workbook(workbook);
        setFile1Sheets(workbook.SheetNames);
        setFile1SelectedSheet("");
        setFile1Columns([]);
        setFile1SelectedColumn("");
        setFile1AdditionalColumns([]);
        setMatches([]);
        setStats(null);
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleFile2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile2(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        setFile2Workbook(workbook);
        setFile2Sheets(workbook.SheetNames);
        setFile2SelectedSheet("");
        setFile2Columns([]);
        setFile2SelectedColumn("");
        setFile2AdditionalColumns([]);
        setMatches([]);
        setStats(null);
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleSheet1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    setFile1SelectedSheet(sheetName);
    setFile1SelectedColumn("");
    setMatches([]);
    setStats(null);

    if (file1Workbook && sheetName) {
      const worksheet = file1Workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length > 0) {
        const headers = jsonData[0] as string[];
        setFile1Columns(headers);
        setFile1AdditionalColumns(headers.map((h) => ({ name: h, selected: false })));
      }
    }
  };

  const handleSheet2Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    setFile2SelectedSheet(sheetName);
    setFile2SelectedColumn("");
    setMatches([]);
    setStats(null);

    if (file2Workbook && sheetName) {
      const worksheet = file2Workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length > 0) {
        const headers = jsonData[0] as string[];
        setFile2Columns(headers);
        setFile2AdditionalColumns(headers.map((h) => ({ name: h, selected: false })));
      }
    }
  };

  const handleAdditionalColumnToggle = (
    columns: ColumnInfo[],
    setColumns: React.Dispatch<React.SetStateAction<ColumnInfo[]>>,
    index: number
  ) => {
    const updated = [...columns];
    updated[index].selected = !updated[index].selected;
    setColumns(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file1Workbook || !file1SelectedSheet || !file1SelectedColumn) {
      alert("Veuillez sélectionner un fichier, une feuille et une colonne pour le fichier 1");
      return;
    }

    if (!file2Workbook || !file2SelectedSheet || !file2SelectedColumn) {
      alert("Veuillez sélectionner un fichier, une feuille et une colonne pour le fichier 2");
      return;
    }

    setLoading(true);

    try {
      const worksheet1 = file1Workbook.Sheets[file1SelectedSheet];
      const file1Data = XLSX.utils.sheet_to_json(worksheet1);

      const worksheet2 = file2Workbook.Sheets[file2SelectedSheet];
      const file2Data = XLSX.utils.sheet_to_json(worksheet2);

      const response = await fetch("/api/match-columns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file1Data,
          file2Data,
          file1Column: file1SelectedColumn,
          file2Column: file2SelectedColumn,
          file1AdditionalColumns: file1AdditionalColumns
            .filter((c) => c.selected)
            .map((c) => c.name),
          file2AdditionalColumns: file2AdditionalColumns
            .filter((c) => c.selected)
            .map((c) => c.name),
          similarityThreshold,
          similarityAlgorithm,
        }),
      });

      const result = await response.json();
      setMatches(result.matches);
      setStats({
        totalFile1Rows: result.totalFile1Rows,
        totalFile2Rows: result.totalFile2Rows,
        matchedCount: result.matchedCount,
        unmatchedCount: result.unmatchedCount,
      });
    } catch (error) {
      console.error("Error processing match request:", error);
      alert("Erreur lors du traitement");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (matches.length === 0) return;

    // Build export data
    const exportData = matches.map((match) => {
      const row: Record<string, any> = {
        [`Fichier1_${file1SelectedColumn}`]: match.file1Value,
        [`Fichier2_${file2SelectedColumn}`]: match.file2Value ?? "",
        "Score_Similarité": match.score ? (match.score * 100).toFixed(1) + "%" : "Non trouvé",
        "Fichier1_Ligne": match.file1RowIndex + 2,
        "Fichier2_Ligne": match.file2RowIndex !== null ? match.file2RowIndex + 2 : "",
      };

      // Add additional columns from file 1
      for (const [key, value] of Object.entries(match.file1AdditionalData)) {
        row[`Fichier1_${key}`] = value;
      }

      // Add additional columns from file 2
      for (const [key, value] of Object.entries(match.file2AdditionalData)) {
        row[`Fichier2_${key}`] = value;
      }

      return row;
    });

    // Create workbook and download
    const newWorkbook = XLSX.utils.book_new();
    const newWorksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Correspondances");

    const file1Name = file1?.name?.replace(/\.[^/.]+$/, "") || "fichier1";
    const file2Name = file2?.name?.replace(/\.[^/.]+$/, "") || "fichier2";
    const exportFileName = `${file1Name}_${file2Name}_matched.xlsx`;

    XLSX.writeFile(newWorkbook, exportFileName);
  };

  const canSubmit =
    file1Workbook &&
    file1SelectedSheet &&
    file1SelectedColumn &&
    file2Workbook &&
    file2SelectedSheet &&
    file2SelectedColumn;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
          Correspondance entre fichiers Excel
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Trouvez les valeurs similaires entre deux colonnes de fichiers différents
        </p>

        <div className="flex flex-col lg:flex-row lg:gap-6">
          {/* Left panel - Settings */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6 lg:mb-0 lg:min-w-[450px] lg:shrink-0 lg:sticky lg:top-6 lg:self-start">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File 1 Section */}
              <div className="border-b pb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">📄 Fichier 1 (source)</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fichier Excel
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFile1Change}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                    />
                  </div>

                  {file1Sheets.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Feuille
                      </label>
                      <select
                        value={file1SelectedSheet}
                        onChange={handleSheet1Change}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Sélectionner --</option>
                        {file1Sheets.map((sheet) => (
                          <option key={sheet} value={sheet}>
                            {sheet}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {file1Columns.length > 0 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Colonne à comparer
                        </label>
                        <select
                          value={file1SelectedColumn}
                          onChange={(e) => setFile1SelectedColumn(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">-- Sélectionner --</option>
                          {file1Columns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Colonnes additionnelles à inclure
                        </label>
                        <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                          {file1AdditionalColumns.map((col, index) => (
                            <div key={index} className="flex items-center mb-1">
                              <input
                                type="checkbox"
                                id={`file1-add-${index}`}
                                checked={col.selected}
                                onChange={() =>
                                  handleAdditionalColumnToggle(
                                    file1AdditionalColumns,
                                    setFile1AdditionalColumns,
                                    index
                                  )
                                }
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label
                                htmlFor={`file1-add-${index}`}
                                className="ml-2 text-sm text-gray-700"
                              >
                                {col.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* File 2 Section */}
              <div className="border-b pb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">📄 Fichier 2 (cible)</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fichier Excel
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFile2Change}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-green-50 file:text-green-700
                        hover:file:bg-green-100"
                    />
                  </div>

                  {file2Sheets.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Feuille
                      </label>
                      <select
                        value={file2SelectedSheet}
                        onChange={handleSheet2Change}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Sélectionner --</option>
                        {file2Sheets.map((sheet) => (
                          <option key={sheet} value={sheet}>
                            {sheet}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {file2Columns.length > 0 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Colonne à comparer
                        </label>
                        <select
                          value={file2SelectedColumn}
                          onChange={(e) => setFile2SelectedColumn(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">-- Sélectionner --</option>
                          {file2Columns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Colonnes additionnelles à inclure
                        </label>
                        <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                          {file2AdditionalColumns.map((col, index) => (
                            <div key={index} className="flex items-center mb-1">
                              <input
                                type="checkbox"
                                id={`file2-add-${index}`}
                                checked={col.selected}
                                onChange={() =>
                                  handleAdditionalColumnToggle(
                                    file2AdditionalColumns,
                                    setFile2AdditionalColumns,
                                    index
                                  )
                                }
                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                              />
                              <label
                                htmlFor={`file2-add-${index}`}
                                className="ml-2 text-sm text-gray-700"
                              >
                                {col.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Similarity Settings */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">⚙️ Paramètres</h2>

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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seuil de similarité: {(similarityThreshold * 100).toFixed(0)}%
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
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Recherche en cours..." : "Trouver les correspondances"}
              </button>
            </form>
          </div>

          {/* Right panel - Results */}
          <div className="flex-1 flex flex-col gap-6 lg:min-w-[50%]">
            {/* Stats */}
            {stats && (
              <div className="bg-white shadow-md rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Résultats</h2>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm"
                  >
                    📥 Exporter en Excel
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalFile1Rows}</div>
                    <div className="text-xs text-gray-600">Lignes fichier 1</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.totalFile2Rows}</div>
                    <div className="text-xs text-gray-600">Lignes fichier 2</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{stats.matchedCount}</div>
                    <div className="text-xs text-gray-600">Correspondances</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{stats.unmatchedCount}</div>
                    <div className="text-xs text-gray-600">Sans correspondance</div>
                  </div>
                </div>
              </div>
            )}

            {/* Matches Table */}
            {matches.length > 0 && (
              <div className="bg-white shadow-md rounded-lg p-6 flex flex-col">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Correspondances détaillées
                </h2>
                <div className="overflow-auto max-h-[600px]">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">
                          Fichier 1 (ligne)
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">
                          Fichier 2 (ligne)
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Score</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {matches.map((match, index) => (
                        <tr
                          key={index}
                          className={`hover:bg-gray-50 ${
                            match.file2RowIndex === null ? "bg-red-50" : ""
                          }`}
                        >
                          <td className="px-4 py-2 text-gray-900">
                            {match.file1Value}
                            <span className="text-gray-400 text-xs ml-1">
                              (#{match.file1RowIndex + 2})
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-900">
                            {match.file2Value ?? (
                              <span className="text-red-500 italic">Non trouvé</span>
                            )}
                            {match.file2RowIndex !== null && (
                              <span className="text-gray-400 text-xs ml-1">
                                (#{match.file2RowIndex + 2})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-500">
                            {match.score > 0 ? (match.score * 100).toFixed(1) + "%" : "-"}
                          </td>
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
