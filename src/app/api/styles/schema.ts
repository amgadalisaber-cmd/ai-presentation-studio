import { z } from "zod";
export const styleSchema = z.object({
  name: z.string().min(1), description: z.string().optional().nullable(), spec: z.any().optional(),
  composition: z.string().optional().nullable(), layoutRules: z.string().optional().nullable(), typography: z.string().optional().nullable(), imageTreatment: z.string().optional().nullable(),
  backgroundTreatment: z.string().optional().nullable(), colorBehavior: z.string().optional().nullable(), lighting: z.string().optional().nullable(), density: z.string().optional().nullable(), decorative: z.string().optional().nullable(), negative: z.string().optional().nullable(), tone: z.string().optional().nullable(), voice: z.string().optional().nullable(),
});
