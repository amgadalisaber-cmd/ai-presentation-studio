import { z } from "zod";
export const participantSchema = z.object({ companyId: z.string(), role: z.enum(["primary", "secondary", "partner", "sponsor", "collaborator", "other"]), roleLabel: z.string().optional().nullable(), instructions: z.string().optional().nullable() });
export const companyEntrySchema = z.object({ companyId: z.string().optional().nullable(), customName: z.string().optional().nullable(), title: z.string().optional().nullable(), contactName: z.string().optional().nullable(), department: z.string().optional().nullable(), logoAssetId: z.string().optional().nullable(), showLogo: z.boolean().optional() });
export const metadataSchema = z.object({ date: z.string().optional(), version: z.string().optional(), preparedBy: z.string().optional(), confidentiality: z.string().optional(), projectName: z.string().optional(), referenceNumber: z.string().optional(), custom: z.array(z.object({ label: z.string(), value: z.string() })).optional(), colorMode: z.enum(["auto", "style", "brand"]).optional() });
export const presentationSchema = z.object({
  name: z.string().min(1), type: z.string().min(1), customType: z.string().optional().nullable(), language: z.enum(["ar", "en", "ar-en", "other"]).optional(),
  content: z.string().optional(), contentSource: z.enum(["paste", "upload", "import", "saved"]).optional(),
  styleId: z.string().optional().nullable(), customDirection: z.string().optional().nullable(), threeStyleMode: z.boolean().optional(), aiImages: z.boolean().optional(),
  presentedByEnabled: z.boolean().optional(), presentedToEnabled: z.boolean().optional(), metadata: metadataSchema.optional(), projectNotes: z.string().optional().nullable(),
  participants: z.array(participantSchema).optional(), presentedBy: z.array(companyEntrySchema).optional(), presentedTo: z.array(companyEntrySchema).optional(),
});
export type PresentationInput = z.infer<typeof presentationSchema>;
