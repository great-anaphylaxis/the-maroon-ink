import { createClient } from "https://esm.sh/@sanity/client";
import { toHTML, uriLooksSafe } from "https://esm.sh/@portabletext/to-html";

const client = createClient({
    projectId: 'w7ogeebt',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2025-12-25'
});