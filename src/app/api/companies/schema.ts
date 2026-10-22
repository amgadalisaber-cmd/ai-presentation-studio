import { z } from "zod";
export const companySchema = z.object({
  name: z.string().min(1), legalName: z.string().optional().nullable(), isClient: z.boolean().optional(),
  industry: z.string().optional().nullable(), description: z.string().optional().nullable(), website: z.string().optional().nullable(),
  positioning: z.string().optional().nullable(), personality: z.string().optional().nullable(), targetAudience: z.string().optional().nullable(),
  colors: z.array(z.object({ name: z.string().optional(), hex: z.string(), role: z.string().optional() })).optional(),
  typography: z.object({ headingFont: z.string().optional(), bodyFont: z.string().optional(), arabicHeadingFont: z.string().optional(), arabicBodyFont: z.string().optional(), notes: z.string().optional() }).optional(),
});
