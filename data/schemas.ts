import { z } from 'zod';

/** Mandatory constant schema (spec section 2). */
export const ConfidenceSchema = z.enum(['H', 'M', 'L', 'HEUR']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ConstantSchema = z
  .object({
    id: z.string().min(1),
    value: z.number().finite(),
    unit: z.string(),
    range: z.tuple([z.number().finite(), z.number().finite()]),
    confidence: ConfidenceSchema,
    sourceIds: z.array(z.string()),
    verified: z.boolean(),
    note: z.string(),
  })
  .refine((c) => c.range[0] <= c.range[1], { message: 'range min > max' })
  .refine((c) => c.value >= c.range[0] - 1e-12 && c.value <= c.range[1] + 1e-12, {
    message: 'value outside documented range',
  })
  .refine((c) => c.sourceIds.length > 0 || c.confidence === 'HEUR', {
    message: 'constant needs at least one source, or must be HEUR / design',
  });
export type Constant = z.infer<typeof ConstantSchema>;

export const SourceSchema = z.object({
  id: z.string().min(1),
  authors: z.string(),
  year: z.number().int().nullable(),
  title: z.string(),
  journal: z.string(),
  doi: z.string().nullable(),
  pmid: z.string().nullable().optional(),
  kind: z.enum(['peer-reviewed', 'consensus', 'database', 'book', 'practitioner', 'design', 'report']),
  constantsInformed: z.array(z.string()),
  verified: z.boolean(),
  notes: z.string(),
});
export type Source = z.infer<typeof SourceSchema>;
export const SourcesFileSchema = z.array(SourceSchema);
