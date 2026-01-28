"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface ColumnInfo {
  name: string;
  selected: boolean;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [workbookData, setWorkbookData] = useState<XLSX.WorkBook | null>(null);
  const [result, setResult] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

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

      const response = await fetch("/api/process-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: jsonData,
          columns: selectedColumns,
        }),
      });

      const result = await response.json();
      setResult(result.uniqueRows);
    } catch (error) {
      console.error("Error processing data:", error);
      alert("Error processing data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Excel File Processor
        </h1>

        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Excel File
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
                  Select Sheet
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
                  Select Columns for Comparison
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

            {/* Submit Button */}
            {columns.length > 0 && (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Process Data"}
              </button>
            )}
          </form>
        </div>

        {/* Results Display */}
        {result && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Results ({result.length} unique rows)
            </h2>
            <div className="overflow-x-auto">
              <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
