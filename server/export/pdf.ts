import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

export interface PDFExportOptions {
  title?: string;
  author?: string;
  language?: string;
}

/**
 * Convert Markdown content to PDF
 */
export async function markdownToPDF(
  markdownContent: string,
  options: PDFExportOptions = {}
): Promise<Buffer> {
  const tempId = randomBytes(16).toString('hex');
  const tempMdPath = join(tmpdir(), `${tempId}.md`);
  const tempPdfPath = join(tmpdir(), `${tempId}.pdf`);

  try {
    // Add metadata header if provided
    let content = markdownContent;
    if (options.title || options.author) {
      const metadata: string[] = ['---'];
      if (options.title) metadata.push(`title: "${options.title}"`);
      if (options.author) metadata.push(`author: "${options.author}"`);
      if (options.language) metadata.push(`lang: ${options.language}`);
      metadata.push('---', '');
      content = metadata.join('\n') + content;
    }

    // Write markdown to temp file
    await writeFile(tempMdPath, content, 'utf-8');

    // Convert using manus-md-to-pdf utility
    await execAsync(`manus-md-to-pdf "${tempMdPath}" "${tempPdfPath}"`);

    // Read the generated PDF
    const { readFile } = await import('fs/promises');
    const pdfBuffer = await readFile(tempPdfPath);

    // Clean up temp files
    await unlink(tempMdPath);
    await unlink(tempPdfPath);

    return pdfBuffer;
  } catch (error) {
    // Clean up on error
    try {
      await unlink(tempMdPath);
    } catch {}
    try {
      await unlink(tempPdfPath);
    } catch {}

    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Merge multiple markdown files and export as PDF
 */
export async function mergeAndExportPDF(
  sections: Array<{ title: string; content: string }>,
  options: PDFExportOptions = {}
): Promise<Buffer> {
  // Merge all sections into a single markdown document
  const mergedContent = sections
    .map((section) => {
      return `# ${section.title}\n\n${section.content}\n\n---\n\n`;
    })
    .join('');

  return markdownToPDF(mergedContent, options);
}

