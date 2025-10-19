import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { markdownToPDF, mergeAndExportPDF } from '../export/pdf';
import { getBook } from '../db';
import { TRPCError } from '@trpc/server';

/**
 * Export router for PDF generation
 */
export const exportRouter = router({
  /**
   * Export a single markdown file to PDF
   */
  markdownToPDF: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        title: z.string().optional(),
        author: z.string().optional(),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const pdfBuffer = await markdownToPDF(input.content, {
        title: input.title,
        author: input.author,
        language: input.language,
      });

      // Convert to base64 for transmission
      return {
        pdf: pdfBuffer.toString('base64'),
        filename: `${input.title || 'document'}.pdf`,
      };
    }),

  /**
   * Export entire book to PDF
   */
  bookToPDF: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        sections: z.array(
          z.object({
            title: z.string(),
            content: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      // Verify ownership
      if (book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      const pdfBuffer = await mergeAndExportPDF(input.sections, {
        title: book.title || book.repoName,
        author: ctx.user.name || ctx.user.id,
        language: book.targetLanguage || undefined,
      });

      return {
        pdf: pdfBuffer.toString('base64'),
        filename: `${book.title || book.repoName}.pdf`,
      };
    }),
});

