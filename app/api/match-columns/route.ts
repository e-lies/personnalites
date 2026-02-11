import { NextRequest, NextResponse } from "next/server";
import natural from "natural";

type SimilarityAlgorithm = "dice" | "jaro-winkler" | "levenshtein";

interface MatchRequest {
  file1Data: any[];
  file2Data: any[];
  file1Column: string;
  file2Column: string;
  file1AdditionalColumns: string[];
  file2AdditionalColumns: string[];
  similarityThreshold: number;
  similarityAlgorithm: SimilarityAlgorithm;
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

export async function POST(request: NextRequest) {
  try {
    const body: MatchRequest = await request.json();
    const {
      file1Data,
      file2Data,
      file1Column,
      file2Column,
      file1AdditionalColumns = [],
      file2AdditionalColumns = [],
      similarityThreshold = 0.8,
      similarityAlgorithm = "dice",
    } = body;

    if (!file1Data || !Array.isArray(file1Data) || file1Data.length === 0) {
      return NextResponse.json(
        { error: "Invalid or empty data for file 1" },
        { status: 400 }
      );
    }

    if (!file2Data || !Array.isArray(file2Data) || file2Data.length === 0) {
      return NextResponse.json(
        { error: "Invalid or empty data for file 2" },
        { status: 400 }
      );
    }

    if (!file1Column || !file2Column) {
      return NextResponse.json(
        { error: "Please select a column from each file" },
        { status: 400 }
      );
    }

    // Pre-process file2 values for matching
    const file2Values = file2Data.map((row, index) => ({
      index,
      value: normalizeValue(row[file2Column]),
      row,
    }));

    const matches: MatchResult[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    // For each row in file1, find the best match in file2
    for (let i = 0; i < file1Data.length; i++) {
      const file1Row = file1Data[i];
      const file1Value = normalizeValue(file1Row[file1Column]);

      // Find best match in file2
      const bestMatch = findBestMatch(
        file1Value,
        file2Values,
        similarityThreshold,
        similarityAlgorithm
      );

      // Collect additional columns from file1
      const file1AdditionalData: Record<string, any> = {};
      for (const col of file1AdditionalColumns) {
        file1AdditionalData[col] = file1Row[col];
      }

      // Collect additional columns from file2 (if match found)
      const file2AdditionalData: Record<string, any> = {};
      if (bestMatch) {
        for (const col of file2AdditionalColumns) {
          file2AdditionalData[col] = bestMatch.row[col];
        }
        matchedCount++;
      } else {
        unmatchedCount++;
      }

      matches.push({
        file1RowIndex: i,
        file2RowIndex: bestMatch?.index ?? null,
        file1Value: file1Row[file1Column],
        file2Value: bestMatch?.row[file2Column] ?? null,
        score: bestMatch?.score ?? 0,
        file1AdditionalData,
        file2AdditionalData,
      });
    }

    return NextResponse.json({
      matches,
      totalFile1Rows: file1Data.length,
      totalFile2Rows: file2Data.length,
      matchedCount,
      unmatchedCount,
    });
  } catch (error) {
    console.error("Error processing match request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function normalizeValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().toLowerCase();
}

function calculateSimilarity(
  str1: string,
  str2: string,
  algorithm: SimilarityAlgorithm
): number {
  if (!str1 || !str2) return 0;
  
  switch (algorithm) {
    case "dice":
      return natural.DiceCoefficient(str1, str2);
    case "jaro-winkler":
      return natural.JaroWinklerDistance(str1, str2);
    case "levenshtein":
      const maxLen = Math.max(str1.length, str2.length);
      if (maxLen === 0) return 1;
      const distance = natural.LevenshteinDistance(str1, str2);
      return 1 - distance / maxLen;
    default:
      return natural.DiceCoefficient(str1, str2);
  }
}

interface File2Entry {
  index: number;
  value: string;
  row: any;
}

function findBestMatch(
  searchValue: string,
  file2Values: File2Entry[],
  threshold: number,
  algorithm: SimilarityAlgorithm
): { index: number; score: number; row: any } | null {
  if (!searchValue) return null;

  let bestMatch: { index: number; score: number; row: any } | null = null;

  for (const entry of file2Values) {
    const score = calculateSimilarity(searchValue, entry.value, algorithm);

    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        index: entry.index,
        score,
        row: entry.row,
      };
    }
  }

  return bestMatch;
}
