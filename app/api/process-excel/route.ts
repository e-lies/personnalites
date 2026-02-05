import { NextRequest, NextResponse } from "next/server";
import natural from "natural";

type ComparisonMode = "exact" | "fuzzy";
type SimilarityAlgorithm = "dice" | "jaro-winkler" | "levenshtein";

interface ProcessRequest {
  data: any[];
  columns: string[];
  comparisonMode?: ComparisonMode; // "exact" for exact duplicates, "fuzzy" for similarity
  similarityThreshold?: number; // 0 = match anything, 1 = exact match only (only used in fuzzy mode)
  similarityAlgorithm?: SimilarityAlgorithm; // Algorithm to use for fuzzy matching
  sliceStart?: number; // Start index for data slice
  sliceEnd?: number; // End index for data slice
}

interface DuplicateInfo {
  original: string;
  duplicate: string;
  originalIndex: number;
  duplicateIndex: number;
  score?: number; // Only for fuzzy mode
}

interface RemoveDuplicatesResult {
  uniqueRows: any[];
  duplicatesFound: DuplicateInfo[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json();
    const { 
      data, 
      columns, 
      comparisonMode = "fuzzy", 
      similarityThreshold = 0.8,
      similarityAlgorithm = "jaro-winkler",
      sliceStart = 0,
      sliceEnd
    } = body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "Invalid or empty data" },
        { status: 400 },
      );
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        { error: "No columns selected" },
        { status: 400 },
      );
    }

    // Apply slice to data
    const endIndex = sliceEnd !== undefined ? sliceEnd : data.length;
    const slicedData = data.slice(sliceStart, endIndex);

    // Remove duplicate/similar rows based on selected columns
    const { uniqueRows: rawUniqueRows, duplicatesFound } = removeDuplicateRows(
      slicedData, 
      columns, 
      comparisonMode, 
      similarityThreshold,
      similarityAlgorithm
    );
    
    const uniqueRows = rawUniqueRows.map((row) => {
      const mergeColumns = columns.map((col) => row[col]).join(" ");
      const isniLink = `https://isni.oclc.org/sru/?query=pica.nw+%3D+%22${mergeColumns}%22&operation=searchRetrieve&recordSchema=isni-b`
      return {...row, isni: `<a href=${isniLink}>${mergeColumns}</a>`};
    });

    return NextResponse.json({
      uniqueRows,
      originalCount: data.length,
      uniqueCount: uniqueRows.length,
      removedCount: data.length - uniqueRows.length,
      duplicatesFound,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function removeDuplicateRows(
  data: any[],
  columns: string[],
  comparisonMode: ComparisonMode,
  threshold: number,
  algorithm: SimilarityAlgorithm
): RemoveDuplicatesResult {
  if (comparisonMode === "exact") {
    return removeExactDuplicates(data, columns);
  }
  return removeFuzzyDuplicates(data, columns, threshold, algorithm);
}

function removeExactDuplicates(data: any[], columns: string[]): RemoveDuplicatesResult {
  const seen = new Map<string, number>(); // signature -> first occurrence index
  const uniqueRows: any[] = [];
  const duplicatesFound: DuplicateInfo[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const signature = createSignature(row, columns);

    if (!seen.has(signature)) {
      seen.set(signature, i);
      uniqueRows.push(row);
    } else {
      duplicatesFound.push({
        original: signature,
        duplicate: signature,
        originalIndex: seen.get(signature)!,
        duplicateIndex: i,
      });
    }
  }

  return { uniqueRows, duplicatesFound };
}

function removeFuzzyDuplicates(
  data: any[], 
  columns: string[], 
  threshold: number,
  algorithm: SimilarityAlgorithm
): RemoveDuplicatesResult {
  const uniqueRows: any[] = [];
  const uniqueSignatures: { signature: string; index: number }[] = [];
  const duplicatesFound: DuplicateInfo[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const signature = createSignature(row, columns);

    // Check if this row is similar to any existing unique row
    const matchResult = findSimilarMatch(signature, uniqueSignatures, threshold, algorithm);

    if (!matchResult) {
      uniqueRows.push(row);
      uniqueSignatures.push({ signature, index: i });
    } else {
      duplicatesFound.push({
        original: matchResult.matchedSignature,
        duplicate: signature,
        originalIndex: matchResult.matchedIndex,
        duplicateIndex: i,
        score: matchResult.score,
      });
    }
  }

  return { uniqueRows, duplicatesFound };
}

interface MatchResult {
  matchedSignature: string;
  matchedIndex: number;
  score: number;
}

function calculateSimilarity(
  str1: string, 
  str2: string, 
  algorithm: SimilarityAlgorithm
): number {
  switch (algorithm) {
    case "dice":
      return natural.DiceCoefficient(str1, str2);
    case "jaro-winkler":
      return natural.JaroWinklerDistance(str1, str2);
    case "levenshtein":
      // Normalize Levenshtein to 0-1 scale (1 = identical)
      const maxLen = Math.max(str1.length, str2.length);
      if (maxLen === 0) return 1;
      const distance = natural.LevenshteinDistance(str1, str2);
      return 1 - distance / maxLen;
    default:
      return natural.JaroWinklerDistance(str1, str2);
  }
}

function findSimilarMatch(
  signature: string,
  existingSignatures: { signature: string; index: number }[],
  threshold: number,
  algorithm: SimilarityAlgorithm
): MatchResult | null {
  if (existingSignatures.length === 0) return null;

  let bestMatch: { signature: string; index: number; score: number } | null = null;

  for (const existing of existingSignatures) {
    const score = calculateSimilarity(signature, existing.signature, algorithm);
    
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { signature: existing.signature, index: existing.index, score };
    }
  }

  if (bestMatch) {
    return {
      matchedSignature: bestMatch.signature,
      matchedIndex: bestMatch.index,
      score: bestMatch.score,
    };
  }

  return null;
}

function createSignature(row: any, columns: string[]): string {
  // Create a unique signature by concatenating selected column values
  const values = columns.map((col) => {
    const value = row[col];

    // Normalize the value for comparison
    if (value === null || value === undefined) {
      return "NULL";
    }

    // Convert to string and trim whitespace, convert to lowercase for case-insensitive comparison
    return String(value).trim().toLowerCase();
  });

  return values.join(" ");
}
