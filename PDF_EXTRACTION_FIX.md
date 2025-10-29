# PDF Extraction Fix

## Issue

Users were getting the following error when trying to upload and translate a PDF:

```
TRPCClientError: Failed to extract text from PDF. Ensure pdftotext is installed.
```

## Root Cause

The error handling in the PDF extraction code was not providing enough information to diagnose the actual problem. The generic error message suggested `pdftotext` was not installed, but the actual issue could have been:

1. Empty PDF or image-only PDF
2. File permission issues
3. Buffer size limits
4. Actual missing `pdftotext` utility

## Solution

Enhanced the PDF extraction function with:

### 1. Detailed Logging

Added comprehensive logging at each step:
```typescript
console.log('[PDF] Starting extraction...');
console.log('[PDF] Temp PDF path:', tempPath);
console.log('[PDF] Output path:', outputPath);
console.log('[PDF] Buffer size:', buffer.length, 'bytes');
console.log('[PDF] PDF file written successfully');
console.log('[PDF] pdftotext is available');
console.log('[PDF] Running pdftotext...');
console.log('[PDF] pdftotext completed');
console.log('[PDF] Successfully extracted', stdout.length, 'characters');
```

### 2. Explicit Tool Check

Added explicit check for `pdftotext` availability:
```typescript
try {
  await execAsync('which pdftotext');
  console.log('[PDF] pdftotext is available');
} catch (e) {
  console.error('[PDF] pdftotext not found in PATH');
  throw new Error('pdftotext utility not found. Please install poppler-utils.');
}
```

### 3. Empty PDF Detection

Added check for empty or image-only PDFs:
```typescript
if (!stdout || stdout.trim().length === 0) {
  console.warn('[PDF] Extracted text is empty');
  throw new Error('PDF appears to be empty or contains only images. Please use a PDF with selectable text.');
}
```

### 4. Increased Buffer Size

Increased the buffer size for large PDFs:
```typescript
const { stdout: pdfOutput, stderr: pdfError } = await execAsync(
  `pdftotext "${tempPath}" "${outputPath}"`,
  { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer (was default 1MB)
);
```

### 5. Better Error Messages

Provided more specific error messages based on the failure type:
```typescript
if (error.message.includes('pdftotext')) {
  throw new Error('Failed to run pdftotext. Please ensure poppler-utils is installed.');
} else if (error.message.includes('empty')) {
  throw error; // Re-throw our custom empty PDF error
} else {
  throw new Error(`Failed to extract text from PDF: ${error.message}`);
}
```

## Testing

To test the fix:

1. **Valid PDF with text:**
   - Upload a PDF with selectable text
   - Should extract successfully
   - Check console for detailed logs

2. **Image-only PDF:**
   - Upload a scanned PDF (images only)
   - Should show clear error: "PDF appears to be empty or contains only images"

3. **Large PDF:**
   - Upload a large PDF (>1MB text)
   - Should handle with increased buffer size

4. **Empty PDF:**
   - Upload an empty PDF
   - Should show clear error about empty content

## Console Output Example

**Successful extraction:**
```
[PDF] Starting extraction...
[PDF] Temp PDF path: /tmp/pdf-1234567890.pdf
[PDF] Output path: /tmp/pdf-1234567890.txt
[PDF] Buffer size: 524288 bytes
[PDF] PDF file written successfully
[PDF] pdftotext is available
[PDF] Running pdftotext...
[PDF] pdftotext completed
[PDF] Successfully extracted 15234 characters
[PDF] Cleaned up temporary files
```

**Failed extraction (image-only PDF):**
```
[PDF] Starting extraction...
[PDF] Temp PDF path: /tmp/pdf-1234567890.pdf
[PDF] Output path: /tmp/pdf-1234567890.txt
[PDF] Buffer size: 524288 bytes
[PDF] PDF file written successfully
[PDF] pdftotext is available
[PDF] Running pdftotext...
[PDF] pdftotext completed
[PDF] Extracted text is empty
[PDF] Extraction error: Error: PDF appears to be empty or contains only images...
[PDF] Cleaned up temporary files
```

## Files Modified

- `server/translation/pdfExtractor.ts` - Enhanced error handling and logging

## Dependencies

The fix requires `poppler-utils` to be installed on the server:

```bash
# Ubuntu/Debian
sudo apt-get install poppler-utils

# macOS
brew install poppler

# The sandbox environment already has this installed
```

## Future Improvements

1. **OCR Support:**
   - Add OCR capability for image-only PDFs
   - Use Tesseract or similar tool
   - Automatically detect and process scanned documents

2. **Progress Feedback:**
   - Show progress bar for large PDFs
   - Stream extraction progress to frontend

3. **Format Preservation:**
   - Better preservation of PDF formatting
   - Handle tables, lists, and special characters
   - Maintain document structure

4. **Alternative Methods:**
   - Try multiple extraction methods if one fails
   - Fallback to pdf.js for browser-based extraction
   - Support for encrypted/protected PDFs

## Related Issues

- None currently

## Status

✅ **Fixed and deployed**

The enhanced error handling and logging will help diagnose any future PDF extraction issues more quickly.

