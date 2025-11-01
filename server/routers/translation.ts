import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { splitDocument, generateTranslationDraft, batchGenerateDrafts } from '../translation/service';
import { extractTextFromPDF, convertPDFTextToMarkdown } from '../translation/pdfExtractorJS';
import { updateBookSections, getBook } from '../db';
import { TRPCError } from '@trpc/server';

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
        base64Data: z.string(),
        sourceLanguage: z.string(),
        targetLanguage: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Decode base64 PDF data
      const buffer = Buffer.from(input.base64Data, 'base64');
      
      // Extract text from PDF
      const text = await extractTextFromPDF(buffer);
      
      // Convert to Markdown
      const markdown = convertPDFTextToMarkdown(text);
      
      // Split into sections
      const sections = await splitDocument(
        markdown,
        input.sourceLanguage,
        input.targetLanguage
      );
      
      return {
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
      
      // Save sections to database for caching
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
    .mutation(async ({ input }) => {
      return await generateTranslationDraft(
        input.section,
        input.sourceLanguage,
        input.targetLanguage,
        input.context
      );
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
    .mutation(async ({ input }) => {
      return await batchGenerateDrafts(input.sections, input.sourceLanguage, input.targetLanguage);
    }),
});

