import { NextRequest, NextResponse } from "next/server";

interface ProcessRequest {
  data: any[];
  columns: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json();
    const { data, columns } = body;

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

    // Remove duplicate/similar rows based on selected columns
    const uniqueRows = removeDuplicateRows(data, columns).map((row) => {
      const mergeColumns = columns.map((col) => row[col]).join(" ");
      const isniLink = `https://isni.oclc.org/sru/?query=pica.nw+%3D+%22${mergeColumns}%22&operation=searchRetrieve&recordSchema=isni-b`
      return {...row, isni: `<a href=${isniLink}>${mergeColumns}</a>`};
    });

    return NextResponse.json({
      uniqueRows,
      originalCount: data.length,
      uniqueCount: uniqueRows.length,
      removedCount: data.length - uniqueRows.length,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function removeDuplicateRows(data: any[], columns: string[]): any[] {
  const seen = new Set<string>();
  const uniqueRows: any[] = [];

  for (const row of data) {
    // Create a signature based on selected columns
    const signature = createSignature(row, columns);

    if (!seen.has(signature)) {
      seen.add(signature);
      uniqueRows.push(row);
    }
  }

  return uniqueRows;
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

  return values.join("|");
}
