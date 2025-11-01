import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

/**
 * Extract text content from PDF buffer using pdf-parse (JavaScript-based)
 * This works in any environment without requiring system dependencies
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('[PDF-JS] Starting extraction...');
  console.log('[PDF-JS] Buffer size:', buffer.length, 'bytes');
  
  try {
    // Parse PDF using pdf-parse v2 API
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    
    console.log('[PDF-JS] Successfully parsed PDF');
    console.log('[PDF-JS] Pages:', result.numPages);
    console.log('[PDF-JS] Extracted text length:', result.text.length, 'characters');
    
    if (!result.text || result.text.trim().length === 0) {
      console.warn('[PDF-JS] Extracted text is empty');
      throw new Error('PDF appears to be empty or contains only images. Please use a PDF with selectable text.');
    }
    
    return result.text;
  } catch (error: any) {
    console.error('[PDF-JS] Extraction error:', error);
    console.error('[PDF-JS] Error message:', error.message);
    
    // Provide specific error messages
    if (error.message.includes('empty') || error.message.includes('images')) {
      throw error; // Re-throw our custom empty PDF error
    } else if (error.message.includes('Invalid PDF')) {
      throw new Error('The uploaded file is not a valid PDF document.');
    } else if (error.message.includes('encrypted')) {
      throw new Error('This PDF is password-protected. Please upload an unencrypted PDF.');
    } else {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
}

/**
 * Convert PDF text to Markdown format
 * Attempts to preserve structure (headings, paragraphs)
 */
export function convertPDFTextToMarkdown(text: string): string {
  // Split into lines
  const lines = text.split('\n');
  const markdown: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      markdown.push('');
      continue;
    }
    
    // Detect potential headings (all caps, short lines, or numbered sections)
    const isAllCaps = line === line.toUpperCase() && line.length < 100 && line.length > 3;
    const isNumberedSection = /^(\d+\.|\d+\.\d+)\s+/.test(line);
    const isShortLine = line.length < 60 && !line.endsWith('.');
    
    if (isAllCaps || isNumberedSection) {
      // Convert to heading
      if (isNumberedSection) {
        markdown.push(`## ${line}`);
      } else {
        markdown.push(`# ${line}`);
      }
    } else if (isShortLine && i < lines.length - 1 && lines[i + 1].trim() === '') {
      // Likely a heading followed by blank line
      markdown.push(`## ${line}`);
    } else {
      // Regular paragraph
      markdown.push(line);
    }
  }
  
  return markdown.join('\n');
}

