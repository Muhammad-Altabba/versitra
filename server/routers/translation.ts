import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { splitDocument, generateTranslationDraft, batchGenerateDrafts } from '../translation/service';
import { extractTextFromPDF, convertPDFTextToMarkdown } from '../translation/pdfExtractorJS';
import { updateBookSections, getBook, updateBookOriginalText } from '../db';
import { TRPCError } from '@trpc/server';
import { trackAiUsage, checkUsageLimit } from '../_core/aiUsageTracking';

/**
 * Translation router
 */
export const translationRouter = router({
  /**
   * Upload and process PDF document
   */
  uploadPDF: protectedProcedure
    .input(
      z.object({
        bookId: z.string().optional(), // Optional: if provided, save to this book
        base64Data: z.string(),
        sourceLanguage: z.string(),
        targetLanguage: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log('[Translation.uploadPDF] Starting PDF upload:', {
        hasBookId: !!input.bookId,
        bookId: input.bookId,
        userId: ctx.user.id,
        pdfSize: input.base64Data.length,
      });
      
      // Decode base64 PDF data
      const buffer = Buffer.from(input.base64Data, 'base64');
      console.log('[Translation.uploadPDF] PDF decoded, buffer size:', buffer.length);
      
      // Extract text from PDF
      const text = await extractTextFromPDF(buffer);
      console.log('[Translation.uploadPDF] Text extracted:', {
        textLength: text.length,
        preview: text.substring(0, 100),
      });
      
      // Convert to Markdown
      const markdown = convertPDFTextToMarkdown(text);
      console.log('[Translation.uploadPDF] Converted to Markdown:', {
        markdownLength: markdown.length,
      });
      
      // Split into sections
      const sections = await splitDocument(
        markdown,
        input.sourceLanguage,
        input.targetLanguage
      );
      console.log('[Translation.uploadPDF] Document split into sections:', sections.length);
      
      // Save to database if bookId is provided
      if (input.bookId) {
        console.log('[Translation.uploadPDF] Saving to database for book:', input.bookId);
        const book = await getBook(input.bookId);
        
        if (!book) {
          console.error('[Translation.uploadPDF] Book not found:', input.bookId);
        } else if (book.userId !== ctx.user.id) {
          console.error('[Translation.uploadPDF] Access denied: user', ctx.user.id, 'does not own book', input.bookId);
        } else {
          console.log('[Translation.uploadPDF] Saving original text and markdown...');
          await updateBookOriginalText(input.bookId, text, markdown);
          console.log('[Translation.uploadPDF] Saving sections...');
          await updateBookSections(input.bookId, sections);
          console.log('[Translation.uploadPDF] ✅ All data saved to database');
        }
      } else {
        console.warn('[Translation.uploadPDF] No bookId provided - data will NOT be saved to database');
      }
      
      return {
        originalText: text,
        markdown,
        sections,
      };
    }),

  /**
   * Split a document into sections for translation
   */
  splitDocument: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        content: z.string(),
        sourceLanguage: z.string(),
        targetLanguage: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify book ownership
      const book = await getBook(input.bookId);
      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      // Split document into sections
      const sections = await splitDocument(input.content, input.sourceLanguage, input.targetLanguage);
      
      // Parse markdown from original content
      // TODO: Implement proper markdown parsing if needed, for now use content as-is
      const parsedMarkdown = input.content; // Placeholder - in future, parse and format markdown
      
      // Save original content and parsed markdown to database
      await updateBookOriginalText(input.bookId, input.content, parsedMarkdown);
      await updateBookSections(input.bookId, sections);
      
      return sections;
    }),

  /**
   * Generate AI translation draft for a single section
   */
  generateDraft: protectedProcedure
    .input(
      z.object({
        section: z.object({
          id: z.string(),
          content: z.string(),
          startLine: z.number(),
          endLine: z.number(),
          type: z.enum(['paragraph', 'heading', 'code', 'list']),
        }),
        sourceLanguage: z.string(),
        targetLanguage: z.string(),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check AI usage limit before generating draft
      const usageCheck = await checkUsageLimit(ctx.user.id);
      
      if (!usageCheck.allowed) {
        console.warn('[Translation.generateDraft] User exceeded AI usage limit:', {
          userId: ctx.user.id,
          current: usageCheck.current,
          limit: usageCheck.limit,
        });
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `AI usage limit exceeded. Current: ${usageCheck.current}/${usageCheck.limit} requests this month.`,
        });
      }

      console.log('[Translation.generateDraft] Generating draft for section:', {
        userId: ctx.user.id,
        sectionId: input.section.id,
        usagePercentage: usageCheck.percentageUsed,
      });

      // Generate the translation draft
      const result = await generateTranslationDraft(
        input.section,
        input.sourceLanguage,
        input.targetLanguage,
        input.context
      );

      // Track AI usage after successful generation
      await trackAiUsage(ctx.user.id, 1, 0);
      console.log('[Translation.generateDraft] ✅ AI usage tracked for user:', ctx.user.id);

      return result;
    }),

  /**
   * Batch generate drafts for multiple sections
   */
  batchGenerateDrafts: protectedProcedure
    .input(
      z.object({
        sections: z.array(
          z.object({
            id: z.string(),
            content: z.string(),
            startLine: z.number(),
            endLine: z.number(),
            type: z.enum(['paragraph', 'heading', 'code', 'list']),
          })
        ),
        sourceLanguage: z.string(),
        targetLanguage: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check AI usage limit before batch generation
      const usageCheck = await checkUsageLimit(ctx.user.id);
      
      if (!usageCheck.allowed) {
        console.warn('[Translation.batchGenerateDrafts] User exceeded AI usage limit:', {
          userId: ctx.user.id,
          current: usageCheck.current,
          limit: usageCheck.limit,
        });
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `AI usage limit exceeded. Current: ${usageCheck.current}/${usageCheck.limit} requests this month.`,
        });
      }

      console.log('[Translation.batchGenerateDrafts] Generating drafts for sections:', {
        userId: ctx.user.id,
        sectionCount: input.sections.length,
        usagePercentage: usageCheck.percentageUsed,
      });

      // Generate drafts
      const result = await batchGenerateDrafts(input.sections, input.sourceLanguage, input.targetLanguage);

      // Track AI usage for all sections
      await trackAiUsage(ctx.user.id, input.sections.length, 0);
      console.log('[Translation.batchGenerateDrafts] ✅ AI usage tracked for user:', {
        userId: ctx.user.id,
        sectionsProcessed: input.sections.length,
      });

      return result;
    }),
});
