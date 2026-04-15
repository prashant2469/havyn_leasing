import { serve } from "inngest/next";

import { inngest } from "@/server/jobs/inngest/client";
import { inngestFunctions } from "@/server/jobs/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
