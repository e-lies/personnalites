# Excel File Processor

A Next.js application that allows users to upload Excel files, select sheets and columns, and remove duplicate/similar rows based on selected criteria.

## Features

- 📁 Upload Excel files (.xlsx, .xls)
- 📊 Select from available sheets in the workbook
- ✅ Choose specific columns for comparison
- 🔍 Automatically detect and remove duplicate rows
- 📝 View results as JSON
- 🎨 Clean, responsive UI with Tailwind CSS

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Excel Processing**: xlsx library
- **UI**: React 19

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository or navigate to the project directory:

```bash
cd c:\nodeProjects\Personnalite_Isni
```

2. Install dependencies:

```bash
npm install
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

```bash
npm run build
npm start
```

## How to Use

1. **Upload an Excel File**: Click the file input and select an Excel file (.xlsx or .xls)

2. **Select a Sheet**: Once uploaded, choose one of the available sheets from the dropdown

3. **Select Columns**: Check the boxes next to the columns you want to use for comparison

4. **Process Data**: Click "Process Data" to remove duplicate rows

5. **View Results**: The unique rows will be displayed in JSON format below the form

## How It Works

### Duplicate Detection

The application detects duplicates by:

- Creating a unique "signature" for each row based on selected columns
- Normalizing values (trimming whitespace, converting to lowercase)
- Comparing signatures to identify similar rows
- Keeping only the first occurrence of each unique signature

### API Endpoint

**POST** `/api/process-excel`

Request body:

```json
{
  "data": [...],
  "columns": ["Column1", "Column2"]
}
```

Response:

```json
{
  "uniqueRows": [...],
  "originalCount": 100,
  "uniqueCount": 85,
  "removedCount": 15
}
```

## Project Structure

```
Personnalite_Isni/
├── app/
│   ├── api/
│   │   └── process-excel/
│   │       └── route.ts          # API endpoint for processing
│   ├── globals.css               # Global styles with Tailwind
│   ├── layout.tsx                # Root layout component
│   └── page.tsx                  # Main page with upload form
├── .github/
│   └── copilot-instructions.md   # Project guidelines
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

## Development

- Edit files in the `app/` directory
- The page auto-updates as you edit files
- API routes are in `app/api/`

## License

ISC
