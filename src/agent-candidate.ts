import { z } from "zod";
import { CandidateV2Schema } from "./gate-contracts.ts";

export const CandidateOutput = z.strictObject({ schemaVersion: z.literal(1), taskId: z.string(), evidenceBundleId: z.string(),
  configurationId: z.string(), stories: z.array(CandidateV2Schema).min(1).max(20) });
