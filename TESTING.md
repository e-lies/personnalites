# Testing the Excel Processor

## Sample Data for Testing

To test the application, create an Excel file with the following structure:

### Example: Sample.xlsx

**Sheet 1: Users**

| ID  | Name       | Email          | Department |
| --- | ---------- | -------------- | ---------- |
| 1   | John Doe   | john@email.com | IT         |
| 2   | Jane Smith | jane@email.com | HR         |
| 3   | John Doe   | john@email.com | IT         |
| 4   | Bob Wilson | bob@email.com  | Sales      |
| 5   | Jane Smith | jane@email.com | HR         |

**Expected Result:**
When selecting columns "Name" and "Email", the application should return 3 unique rows (removing rows 3 and 5 as duplicates).

## Testing Steps

1. Create an Excel file with duplicate data
2. Open http://localhost:3000
3. Upload the Excel file
4. Select a sheet from the dropdown
5. Check the columns you want to use for comparison (e.g., "Name", "Email")
6. Click "Process Data"
7. View the unique rows in the results section

## Features to Test

- ✅ Upload different Excel file formats (.xlsx, .xls)
- ✅ Switch between different sheets
- ✅ Select single or multiple columns
- ✅ Verify duplicate detection works correctly
- ✅ Check case-insensitive comparison (e.g., "John" vs "john")
- ✅ Test with empty cells
- ✅ Test with special characters

## Notes

- The comparison is case-insensitive
- Whitespace is trimmed before comparison
- Null/undefined values are treated as "NULL"
- Only the first occurrence of each unique row is kept
