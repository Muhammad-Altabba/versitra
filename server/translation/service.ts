import { invokeLLM } from '../_core/llm';

export interface DocumentSection {
  id: string;
  content: string;
  startLine: number;
  endLine: number;
  type: 'paragraph' | 'heading' | 'code' | 'list';
}

export interface TranslationDraft {
  sectionId: string;
  original: string;
  translated: string;
  confidence: number;
}

/**
 * Split a Markdown document into logical sections
 */
export async function splitDocument(
  content: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<DocumentSection[]> {
  const lines = content.split('\n');
  
  // Use AI to suggest contextual splits
  const prompt = `You are a document analysis expert. Analyze this ${sourceLanguage} Markdown document and split it into logical translation sections.

Each section should be:
- A complete semantic unit (multiple related paragraphs, a chapter section, or a logical topic)
- Substantial size: 500-1500 words per section (optimal for LLM context)
- Group related content together (don't split every paragraph)
- Preserve Markdown structure and hierarchy

Document:
\`\`\`markdown
${content}
\`\`\`

Return a JSON array of sections with this structure:
{
  "sections": [
    {
      "id": "section-1",
      "content": "section content here",
      "startLine": 0,
      "endLine": 5,
      "type": "paragraph" | "heading" | "code" | "list"
    }
  ]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a document analysis expert. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'document_sections',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    content: { type: 'string' },
                    startLine: { type: 'integer' },
                    endLine: { type: 'integer' },
                    type: { type: 'string', enum: ['paragraph', 'heading', 'code', 'list'] },
                  },
                  required: ['id', 'content', 'startLine', 'endLine', 'type'],
                  additionalProperties: false,
                },
              },
            },
            required: ['sections'],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const contentText = typeof messageContent === 'string' ? messageContent : '';
    const result = JSON.parse(contentText || '{"sections":[]}');
    return result.sections;
  } catch (error) {
    console.error('[Translation] Failed to split document with AI:', error);
    
    // Fallback: simple paragraph-based splitting
    return simpleSplit(content);
  }
}

/**
 * Simple fallback splitting by semantic chunks
 * Creates larger sections (500-1500 words) suitable for LLM processing
 */
function simpleSplit(content: string): DocumentSection[] {
  const lines = content.split('\n');
  const sections: DocumentSection[] = [];
  let currentSection: string[] = [];
  let startLine = 0;
  let sectionId = 1;
  let wordCount = 0;
  const MIN_WORDS = 300; // Minimum words per section
  const MAX_WORDS = 1500; // Maximum words per section

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWords = line.split(/\s+/).filter(w => w.length > 0).length;
    
    // Check if this is a major heading (# or ##)
    const isMajorHeading = line.match(/^#{1,2}\s/);
    
    // Split conditions:
    // 1. Hit a major heading AND we have enough content
    // 2. Reached max word count
    // 3. Double empty line (paragraph break) AND we have enough content
    const shouldSplit = 
      (isMajorHeading && wordCount >= MIN_WORDS) ||
      (wordCount >= MAX_WORDS) ||
      (line.trim() === '' && lines[i - 1]?.trim() === '' && wordCount >= MIN_WORDS);

    if (shouldSplit && currentSection.length > 0) {
      sections.push({
        id: `section-${sectionId++}`,
        content: currentSection.join('\n').trim(),
        startLine,
        endLine: i - 1,
        type: detectType(currentSection[0]),
      });
      currentSection = [];
      wordCount = 0;
      startLine = i;
    }
    
    if (line.trim() !== '' || currentSection.length > 0) {
      currentSection.push(line);
      wordCount += lineWords;
    }
  }

  // Add last section
  if (currentSection.length > 0) {
    sections.push({
      id: `section-${sectionId}`,
      content: currentSection.join('\n').trim(),
      startLine,
      endLine: lines.length - 1,
      type: detectType(currentSection[0]),
    });
  }

  return sections;
}

/**
 * Detect section type from first line
 */
function detectType(firstLine: string): 'paragraph' | 'heading' | 'code' | 'list' {
  if (firstLine.startsWith('#')) return 'heading';
  if (firstLine.startsWith('```')) return 'code';
  if (firstLine.match(/^[\*\-\+]\s/) || firstLine.match(/^\d+\.\s/)) return 'list';
  return 'paragraph';
}

/**
 * Generate AI translation draft for a section
 */
export async function generateTranslationDraft(
  section: DocumentSection,
  sourceLanguage: string,
  targetLanguage: string,
  context?: string
): Promise<TranslationDraft> {
  const prompt = `Translate the following ${sourceLanguage} Markdown text to ${targetLanguage}.

Requirements:
- Preserve all Markdown formatting (headings, bold, italic, links, code blocks, etc.)
- Maintain the same structure and layout
- Keep technical terms and code snippets unchanged
- Provide natural, fluent translation

${context ? `Context: ${context}\n\n` : ''}Original text:
\`\`\`markdown
${section.content}
\`\`\`

Provide ONLY the translated text in Markdown format, without any explanations.`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in ${sourceLanguage} to ${targetLanguage} translation. Preserve Markdown formatting.`,
        },
        { role: 'user', content: prompt },
      ],
    });

    const messageContent = response.choices[0].message.content;
    const translated = typeof messageContent === 'string' ? messageContent : section.content;

    return {
      sectionId: section.id,
      original: section.content,
      translated: translated.trim(),
      confidence: 0.85, // Could be enhanced with actual confidence scoring
    };
  } catch (error) {
    console.error('[Translation] Failed to generate draft:', error);
    
    return {
      sectionId: section.id,
      original: section.content,
      translated: section.content, // Fallback: return original
      confidence: 0,
    };
  }
}

/**
 * Batch generate translation drafts for multiple sections
 */
export async function batchGenerateDrafts(
  sections: DocumentSection[],
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslationDraft[]> {
  const drafts: TranslationDraft[] = [];

  // Process sections in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, i + batchSize);
    const batchPromises = batch.map(section =>
      generateTranslationDraft(section, sourceLanguage, targetLanguage)
    );

    const batchResults = await Promise.all(batchPromises);
    drafts.push(...batchResults);
  }

  return drafts;
}

