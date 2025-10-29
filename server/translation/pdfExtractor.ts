import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

/**
 * Extract text content from PDF buffer using pdftotext
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const timestamp = Date.now();
  const tempPath = join(tmpdir(), `pdf-${timestamp}.pdf`);
  const outputPath = join(tmpdir(), `pdf-${timestamp}.txt`);
  
  console.log('[PDF] Starting extraction...');
  console.log('[PDF] Temp PDF path:', tempPath);
  console.log('[PDF] Output path:', outputPath);
  console.log('[PDF] Buffer size:', buffer.length, 'bytes');
  
  try {
    // Write buffer to temporary file
    await writeFile(tempPath, buffer);
    console.log('[PDF] PDF file written successfully');
    
    // Check if pdftotext is available
    try {
      await execAsync('which pdftotext');
      console.log('[PDF] pdftotext is available');
    } catch (e) {
      console.error('[PDF] pdftotext not found in PATH');
      throw new Error('pdftotext utility not found. Please install poppler-utils.');
    }
    
    // Use pdftotext to extract text
    console.log('[PDF] Running pdftotext...');
    const { stdout: pdfOutput, stderr: pdfError } = await execAsync(
      `pdftotext "${tempPath}" "${outputPath}"`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );
    
    if (pdfError) {
      console.warn('[PDF] pdftotext stderr:', pdfError);
    }
    console.log('[PDF] pdftotext completed');
    
    // Read extracted text
    const { stdout, stderr } = await execAsync(`cat "${outputPath}"`);
    
    if (stderr) {
      console.warn('[PDF] cat stderr:', stderr);
    }
    
    if (!stdout || stdout.trim().length === 0) {
      console.warn('[PDF] Extracted text is empty');
      throw new Error('PDF appears to be empty or contains only images. Please use a PDF with selectable text.');
    }
    
    console.log('[PDF] Successfully extracted', stdout.length, 'characters');
    return stdout;
  } catch (error: any) {
    console.error('[PDF] Extraction error:', error);
    console.error('[PDF] Error message:', error.message);
    console.error('[PDF] Error stack:', error.stack);
    
    // Provide more specific error messages
    if (error.message.includes('pdftotext')) {
      throw new Error('Failed to run pdftotext. Please ensure poppler-utils is installed.');
    } else if (error.message.includes('empty')) {
      throw error; // Re-throw our custom empty PDF error
    } else {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  } finally {
    // Cleanup temporary files
    try {
      await unlink(tempPath);
      await unlink(outputPath);
      console.log('[PDF] Cleaned up temporary files');
    } catch (e) {
      console.warn('[PDF] Failed to cleanup temporary files:', e);
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

