export interface Env {
  STRIPE_PUBLISHABLE_KEY: string;
}

interface CardPayload {
  reference_id?: string; // Client-provided ID to map results back
  number: string;
  exp_month: string | number;
  exp_year: string | number;
  cvc: string;
}

interface BulkRequestPayload {
  cards: CardPayload[];
}

interface ValidationResult {
  reference_id?: string;
  valid: boolean;
  tokenId?: string;
  card_brand?: string;
  error?: string;
  code?: string;
}

// Configuration
const CONCURRENCY_LIMIT = 5; // Process 5 cards at a time to respect rate limits

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Restrict in production
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/validate-cards-bulk") {
      return await handleBulkValidation(request, env, corsHeaders);
    }

    return new Response(JSON.stringify({ error: "Endpoint not found." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handles the bulk validation request with chunking.
 */
async function handleBulkValidation(request: Request, env: Env, corsHeaders: HeadersInit): Promise<Response> {
  if (!env.STRIPE_PUBLISHABLE_KEY) {
    return new Response(JSON.stringify({ error: "Infrastructure Error: STRIPE_PUBLISHABLE_KEY missing." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json<BulkRequestPayload>();

    if (!body.cards || !Array.isArray(body.cards) || body.cards.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload. Expected a 'cards' array." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.cards.length > 50) {
      return new Response(JSON.stringify({ error: "Batch size exceeds maximum limit of 50." }), {
        status: 413, // Payload Too Large
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIp = request.headers.get("CF-Connecting-IP") || "";
    const results: ValidationResult[] = [];

    // Chunk the array to respect concurrency limits
    const chunks = chunkArray(body.cards, CONCURRENCY_LIMIT);

    for (const chunk of chunks) {
      // Process the current chunk concurrently
      const chunkPromises = chunk.map(card => validateSingleCard(card, env.STRIPE_PUBLISHABLE_KEY, clientIp));
      
      // Wait for the entire chunk to finish before moving to the next
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return new Response(JSON.stringify({
      total_processed: results.length,
      success_count: results.filter(r => r.valid).length,
      failure_count: results.filter(r => !r.valid).length,
      results: results
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Malformed JSON or server failure." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

/**
 * Validates a single card against the Stripe API
 */
async function validateSingleCard(card: CardPayload, publishableKey: string, clientIp: string): Promise<ValidationResult> {
  const baseResult: Partial<ValidationResult> = { reference_id: card.reference_id };

  if (!card.number || !card.exp_month || !card.exp_year || !card.cvc) {
    return { ...baseResult, valid: false, error: "Missing required fields" } as ValidationResult;
  }

  const stripePayload = new URLSearchParams();
  stripePayload.append("card[number]", String(card.number).replace(/\s+/g, ''));
  stripePayload.append("card[exp_month]", String(card.exp_month));
  stripePayload.append("card[exp_year]", String(card.exp_year));
  stripePayload.append("card[cvc]", String(card.cvc));

  try {
    const stripeResponse = await fetch("https://api.stripe.com/v1/tokens", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${publishableKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2023-10-16",
        "Stripe-Context": clientIp,
      },
      body: stripePayload.toString(),
    });

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return {
        ...baseResult,
        valid: false,
        error: stripeData.error?.message || "Stripe validation failed.",
        code: stripeData.error?.code || stripeData.error?.decline_code,
      } as ValidationResult;
    }

    return {
      ...baseResult,
      valid: true,
      tokenId: stripeData.id,
      card_brand: stripeData.card?.brand,
    } as ValidationResult;

  } catch (err) {
    return { ...baseResult, valid: false, error: "Network failure reaching Stripe." } as ValidationResult;
  }
}

/**
 * Utility: Splits an array into smaller chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
