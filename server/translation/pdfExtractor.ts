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
  const tempPath = join(tmpdir(), `pdf-${Date.now()}.pdf`);
  const outputPath = join(tmpdir(), `pdf-${Date.now()}.txt`);
  
  try {
    // Write buffer to temporary file
    await writeFile(tempPath, buffer);
    
    // Use pdftotext to extract text
    await execAsync(`pdftotext "${tempPath}" "${outputPath}"`);
    
    // Read extracted text
    const { stdout } = await execAsync(`cat "${outputPath}"`);
    
    return stdout;
  } catch (error) {
    console.error('[PDF] Extraction error:', error);
    throw new Error('Failed to extract text from PDF. Ensure pdftotext is installed.');
  } finally {
    // Cleanup temporary files
    try {
      await unlink(tempPath);
      await unlink(outputPath);
    } catch (e) {
      // Ignore cleanup errors
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

