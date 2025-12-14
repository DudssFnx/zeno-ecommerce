import { db } from "../db";
import { products, categories, type InsertProduct, type InsertCategory } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const BLING_API_BASE = "https://api.bling.com.br/Api/v3";
const BLING_OAUTH_URL = "https://www.bling.com.br/Api/v3/oauth";

interface BlingTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface BlingProductBasic {
  id: number;
  nome: string;
  codigo: string;
  preco: number;
  tipo: string;
  situacao: string;
}

interface BlingProductFull {
  id: number;
  nome: string;
  codigo: string;
  preco: number;
  precoCusto?: number;
  tipo: string;
  situacao: string;
  descricaoCurta?: string;
  descricaoComplementar?: string;
  marca?: string;
  categoria?: {
    id: number;
    descricao?: string;
  };
  estoque?: {
    minimo?: number;
    maximo?: number;
    saldoFisico?: number;
    saldoVirtual?: number;
  };
  imagens?: Array<{
    id: number;
    tipo?: string;
    ordem?: number;
    linkExterno?: string;
    link?: string;
  }>;
  midia?: {
    imagens?: {
      externas?: Array<{ link: string }>;
      internas?: Array<{ link: string }>;
    };
  };
}

interface BlingCategory {
  id: number;
  descricao: string;
  idCategoriaPai?: number;
}

let cachedTokens: BlingTokens | null = null;
let tokenExpiresAt: number = 0;

function getBasicAuthHeader(): string {
  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("BLING_CLIENT_ID and BLING_CLIENT_SECRET are required");
  }
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export function getAuthorizationUrl(redirectUri: string): string {
  const clientId = process.env.BLING_CLIENT_ID;
  if (!clientId) {
    throw new Error("BLING_CLIENT_ID is required");
  }
  const state = Math.random().toString(36).substring(2);
  return `${BLING_OAUTH_URL}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<BlingTokens> {
  const response = await fetch(`${BLING_OAUTH_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${getBasicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Bling token exchange error:", error);
    throw new Error(`Failed to exchange code for tokens: ${response.status}`);
  }

  const tokens: BlingTokens = await response.json();
  cachedTokens = tokens;
  tokenExpiresAt = Date.now() + (tokens.expires_in * 1000) - 60000;
  
  process.env.BLING_ACCESS_TOKEN = tokens.access_token;
  process.env.BLING_REFRESH_TOKEN = tokens.refresh_token;
  
  return tokens;
}

export async function refreshAccessToken(): Promise<BlingTokens> {
  const refreshToken = process.env.BLING_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("No refresh token available. Please re-authorize.");
  }

  const response = await fetch(`${BLING_OAUTH_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${getBasicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Bling token refresh error:", error);
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  const tokens: BlingTokens = await response.json();
  cachedTokens = tokens;
  tokenExpiresAt = Date.now() + (tokens.expires_in * 1000) - 60000;
  
  process.env.BLING_ACCESS_TOKEN = tokens.access_token;
  process.env.BLING_REFRESH_TOKEN = tokens.refresh_token;
  
  return tokens;
}

async function getValidAccessToken(): Promise<string> {
  const accessToken = process.env.BLING_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error("Not authenticated with Bling. Please authorize first.");
  }
  
  // Always return the access token - refresh will happen on 401 in blingApiRequest
  return accessToken;
}

async function blingApiRequest<T>(endpoint: string): Promise<T> {
  const accessToken = await getValidAccessToken();
  
  const response = await fetch(`${BLING_API_BASE}${endpoint}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });

  if (response.status === 401) {
    try {
      await refreshAccessToken();
      return blingApiRequest<T>(endpoint);
    } catch {
      throw new Error("Authentication failed. Please re-authorize with Bling.");
    }
  }

  if (!response.ok) {
    const error = await response.text();
    console.error(`Bling API error for ${endpoint}:`, error);
    throw new Error(`Bling API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchBlingProductsList(page: number = 1, limit: number = 100): Promise<BlingProductBasic[]> {
  const response = await blingApiRequest<{ data: BlingProductBasic[] }>(
    `/produtos?pagina=${page}&limite=${limit}&tipo=P&criterio=1`
  );
  return response.data || [];
}

export async function fetchBlingProductDetails(productId: number, throwOn429: boolean = false): Promise<BlingProductFull | null> {
  try {
    const response = await blingApiRequest<{ data: BlingProductFull }>(`/produtos/${productId}`);
    return response.data || null;
  } catch (error) {
    const message = String(error);
    if (throwOn429 && message.includes("429")) {
      throw error;
    }
    console.error(`Failed to fetch product ${productId}:`, error);
    return null;
  }
}

export async function fetchBlingCategories(): Promise<BlingCategory[]> {
  const response = await blingApiRequest<{ data: BlingCategory[] }>("/categorias/produtos");
  return response.data || [];
}

interface BlingStockItem {
  produto: { id: number };
  saldoFisicoTotal: number;
  saldoVirtualTotal: number;
}

interface BlingStockResponse {
  id: number;
  codigo: string;
  nome: string;
  estoqueAtual: number;
  depositos?: Array<{
    id: number;
    nome: string;
    saldo: number;
    saldoVirtual: number;
  }>;
}

export async function fetchBlingStock(productIds: number[]): Promise<Map<number, number>> {
  const stockMap = new Map<number, number>();
  
  const batchSize = 50;
  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const idsParam = batch.join(',');
    
    try {
      const response = await blingApiRequest<{ data: BlingStockResponse[] }>(
        `/estoques?idsProdutos=${idsParam}`
      );
      
      if (response.data) {
        for (const item of response.data) {
          let totalStock = item.estoqueAtual || 0;
          if (item.depositos && item.depositos.length > 0) {
            totalStock = item.depositos.reduce((sum, d) => sum + (d.saldoVirtual || d.saldo || 0), 0);
          }
          stockMap.set(item.id, Math.floor(totalStock));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to fetch stock for batch starting at ${i}:`, error);
      if (String(error).includes("429")) {
        console.log("Rate limit hit on stock, waiting 30 seconds...");
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }
  
  return stockMap;
}

export async function syncCategories(): Promise<{ created: number; updated: number }> {
  const blingCategories = await fetchBlingCategories();
  let created = 0;
  let updated = 0;

  const blingIdToLocalId: Record<number, number> = {};
  const blingCatMap = new Map<number, BlingCategory>();
  blingCategories.forEach(c => blingCatMap.set(c.id, c));

  function topologicalSort(cats: BlingCategory[]): BlingCategory[] {
    const sorted: BlingCategory[] = [];
    const visited = new Set<number>();
    
    function visit(cat: BlingCategory) {
      if (visited.has(cat.id)) return;
      visited.add(cat.id);
      
      if (cat.idCategoriaPai && blingCatMap.has(cat.idCategoriaPai)) {
        visit(blingCatMap.get(cat.idCategoriaPai)!);
      }
      
      sorted.push(cat);
    }
    
    cats.forEach(c => visit(c));
    return sorted;
  }

  const sortedCategories = topologicalSort(blingCategories);

  for (const cat of sortedCategories) {
    const slug = cat.descricao
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `cat-${cat.id}`;

    const parentLocalId = cat.idCategoriaPai ? blingIdToLocalId[cat.idCategoriaPai] || null : null;

    let existing = await db.select().from(categories).where(eq(categories.blingId, cat.id)).limit(1);
    
    if (existing.length === 0) {
      existing = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    }

    if (existing.length === 0) {
      const [newCat] = await db.insert(categories).values({
        name: cat.descricao,
        slug,
        parentId: parentLocalId,
        blingId: cat.id,
      }).returning();
      blingIdToLocalId[cat.id] = newCat.id;
      created++;
    } else {
      await db.update(categories).set({ 
        name: cat.descricao,
        slug,
        parentId: parentLocalId,
        blingId: cat.id,
      }).where(eq(categories.id, existing[0].id));
      blingIdToLocalId[cat.id] = existing[0].id;
      updated++;
    }
  }

  return { created, updated };
}

async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  let completed = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i]);
      } catch (error) {
        results[i] = null as R;
      }
      completed++;
      if (onProgress && completed % 50 === 0) {
        onProgress(completed, items.length);
      }
    }
  }

  await Promise.all(Array(Math.min(concurrency, items.length)).fill(0).map(() => worker()));
  return results;
}

async function fetchProductDetailsWithRetry(productId: number): Promise<BlingProductFull | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await fetchBlingProductDetails(productId, true);
      return result;
    } catch (error) {
      const message = String(error);
      if (message.includes("429")) {
        const waitTime = Math.pow(2, attempt) * 5000 + Math.random() * 1000;
        console.log(`Rate limit on product ${productId}, attempt ${attempt + 1}/3, waiting ${(waitTime/1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error(`Error fetching product ${productId}:`, message);
        return null;
      }
    }
  }
  console.error(`Failed to fetch product ${productId} after 3 retries`);
  return null;
}

async function fetchProductListWithRetry(page: number, limit: number): Promise<BlingProductBasic[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fetchBlingProductsList(page, limit);
    } catch (error) {
      const message = String(error);
      if (message.includes("429")) {
        const waitTime = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
        console.log(`Rate limit on product list page ${page}, attempt ${attempt + 1}/5, waiting ${(waitTime/1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Failed to fetch product list page ${page} after 5 retries`);
}

async function fetchCategoriesWithRetry(): Promise<BlingCategory[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fetchBlingCategories();
    } catch (error) {
      const message = String(error);
      if (message.includes("429")) {
        const waitTime = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
        console.log(`Rate limit on categories, attempt ${attempt + 1}/5, waiting ${(waitTime/1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed to fetch categories after 5 retries");
}

export async function syncProducts(): Promise<{ created: number; updated: number; errors: string[] }> {
  const startTime = Date.now();
  let basicProducts: BlingProductBasic[] = [];
  let page = 1;
  const limit = 100;
  
  console.log("Fetching product list from Bling (with rate limit handling)...");
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const pageProducts = await fetchProductListWithRetry(page, limit);
    if (pageProducts.length === 0) break;
    
    for (const p of pageProducts) {
      if (p.situacao === "A") {
        basicProducts.push(p);
      }
    }
    console.log(`Page ${page}: ${pageProducts.length} products (${basicProducts.length} active total)`);
    
    if (pageProducts.length < limit) break;
    page++;
  }
  
  console.log(`Found ${basicProducts.length} active products.`);

  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log("Fetching categories from Bling for mapping...");
  const blingCategories = await fetchCategoriesWithRetry();
  const blingCatIdToName: Record<number, string> = {};
  blingCategories.forEach(bc => {
    blingCatIdToName[bc.id] = bc.descricao;
  });

  const existingCategories = await db.select().from(categories);
  const categoryMap: Record<string, number> = {};
  const blingIdToCategoryId: Record<number, number> = {};
  existingCategories.forEach(c => {
    categoryMap[c.name.toLowerCase()] = c.id;
    if (c.blingId) {
      blingIdToCategoryId[c.blingId] = c.id;
    }
  });
  console.log(`Loaded ${Object.keys(categoryMap).length} local categories`);

  console.log(`Fetching product details sequentially (1 req per 600ms = ~1.6 req/s)...`);
  const productIds = basicProducts.map(p => p.id);
  const blingProducts = await runWithConcurrency(
    productIds,
    async (id) => {
      await new Promise(resolve => setTimeout(resolve, 600));
      return fetchProductDetailsWithRetry(id);
    },
    1,
    (done, total) => { if (done % 50 === 0) console.log(`Fetched ${done}/${total} product details...`); }
  );
  console.log(`Fetched all product details.`);

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < productIds.length; i++) {
    const productId = productIds[i];
    const blingProduct = blingProducts[i];
    
    if (!blingProduct) {
      errors.push(`Product ${productId}: Failed to fetch details`);
      continue;
    }

    try {
      let categoryId: number | null = null;
      const blingCat = blingProduct.categoria;
      if (blingCat && blingCat.id) {
        categoryId = blingIdToCategoryId[blingCat.id] || null;
        if (!categoryId) {
          const blingCatName = blingCatIdToName[blingCat.id] || blingCat.descricao;
          if (blingCatName) {
            categoryId = categoryMap[blingCatName.toLowerCase()] || null;
          }
        }
      }

      let imageUrl: string | null = null;
      if (blingProduct.imagens && blingProduct.imagens.length > 0) {
        const sortedImages = [...blingProduct.imagens].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        imageUrl = sortedImages[0]?.linkExterno || sortedImages[0]?.link || null;
      }
      if (!imageUrl && blingProduct.midia?.imagens?.externas?.[0]?.link) {
        imageUrl = blingProduct.midia.imagens.externas[0].link;
      }
      if (!imageUrl && blingProduct.midia?.imagens?.internas?.[0]?.link) {
        imageUrl = blingProduct.midia.imagens.internas[0].link;
      }

      const description = blingProduct.descricaoComplementar || blingProduct.descricaoCurta || null;
      const stock = blingProduct.estoque?.saldoVirtual ?? blingProduct.estoque?.saldoFisico ?? 0;

      const productData: InsertProduct = {
        name: blingProduct.nome,
        sku: blingProduct.codigo || `BLING-${blingProduct.id}`,
        categoryId,
        brand: blingProduct.marca || null,
        description,
        price: String(blingProduct.preco || 0),
        stock,
        image: imageUrl,
      };

      const existing = await db.select().from(products).where(eq(products.sku, productData.sku)).limit(1);

      if (existing.length === 0) {
        await db.insert(products).values(productData);
        created++;
      } else {
        await db.update(products)
          .set({
            name: productData.name,
            categoryId: productData.categoryId,
            brand: productData.brand,
            description: productData.description,
            price: productData.price,
            stock: productData.stock,
            image: productData.image,
          })
          .where(eq(products.sku, productData.sku));
        updated++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Product ${productId}: ${message}`);
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Sync complete in ${elapsed}s: ${created} created, ${updated} updated, ${errors.length} errors`);

  return { created, updated, errors };
}

export function isAuthenticated(): boolean {
  return !!process.env.BLING_ACCESS_TOKEN;
}

export function getStatus(): { authenticated: boolean; hasCredentials: boolean } {
  return {
    authenticated: isAuthenticated(),
    hasCredentials: !!(process.env.BLING_CLIENT_ID && process.env.BLING_CLIENT_SECRET),
  };
}

// ========== WEBHOOK HANDLING ==========

interface BlingWebhookPayload {
  eventId: string;
  date: string;
  version: string;
  event: string;
  companyId: string;
  data: any;
}

interface WebhookProductData {
  id: number;
  nome: string;
  codigo: string;
  tipo: string;
  situacao: string;
  preco: number;
  unidade?: string;
  formato?: string;
  idProdutoPai?: number;
  categoria?: { id: number };
  descricaoCurta?: string;
  descricaoComplementar?: string;
}

interface WebhookStockData {
  produto: { id: number };
  deposito?: { id: number; saldoFisico: number; saldoVirtual: number };
  operacao?: string;
  quantidade?: number;
  saldoFisicoTotal: number;
  saldoVirtualTotal: number;
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  if (!clientSecret) {
    console.error("BLING_CLIENT_SECRET not configured for webhook verification");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", clientSecret)
    .update(payload, "utf8")
    .digest("hex");

  // Handle both formats: "sha256=HASH" or just "HASH"
  const providedHash = signature.replace(/^sha256=/i, "");
  
  // Ensure both signatures have same length before comparing
  if (expectedSignature.length !== providedHash.length) {
    console.error("Signature length mismatch");
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(providedHash, "hex")
    );
  } catch (error) {
    console.error("Signature comparison error:", error);
    return false;
  }
}

export async function handleWebhook(payload: BlingWebhookPayload): Promise<{ success: boolean; message: string }> {
  const { event, data, eventId } = payload;
  console.log(`Processing Bling webhook: ${event} (${eventId})`);

  try {
    switch (event) {
      case "product.created":
      case "product.updated":
        return await handleProductEvent(data as WebhookProductData);
      case "product.deleted":
        return await handleProductDeleted(data.id);
      case "stock.created":
      case "stock.updated":
        return await handleStockEvent(data as WebhookStockData);
      default:
        console.log(`Unhandled webhook event: ${event}`);
        return { success: true, message: `Event ${event} acknowledged but not processed` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Webhook processing error for ${event}:`, message);
    return { success: false, message };
  }
}

async function handleProductEvent(data: WebhookProductData): Promise<{ success: boolean; message: string }> {
  const sku = data.codigo || `BLING-${data.id}`;
  
  if (data.situacao !== "A") {
    const existing = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
    if (existing.length > 0) {
      await db.delete(products).where(eq(products.sku, sku));
      return { success: true, message: `Product ${sku} deleted (inactive)` };
    }
    return { success: true, message: `Inactive product ${sku} ignored` };
  }

  const productData: Partial<InsertProduct> = {
    name: data.nome,
    sku,
    description: data.descricaoCurta || null,
    price: String(data.preco || 0),
  };

  const existing = await db.select().from(products).where(eq(products.sku, sku)).limit(1);

  if (existing.length === 0) {
    await db.insert(products).values(productData as InsertProduct);
    return { success: true, message: `Product ${sku} created` };
  } else {
    await db.update(products).set(productData).where(eq(products.sku, sku));
    return { success: true, message: `Product ${sku} updated` };
  }
}

async function handleProductDeleted(blingId: number): Promise<{ success: boolean; message: string }> {
  const sku = `BLING-${blingId}`;
  const existing = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
  
  if (existing.length > 0) {
    await db.delete(products).where(eq(products.sku, sku));
    return { success: true, message: `Product ${sku} deleted` };
  }
  
  return { success: true, message: `Product ${blingId} not found locally` };
}

async function handleStockEvent(data: WebhookStockData): Promise<{ success: boolean; message: string }> {
  const blingProductId = data.produto.id;
  const newStock = data.saldoVirtualTotal;

  const allProducts = await db.select().from(products);
  const product = allProducts.find(p => p.sku === `BLING-${blingProductId}` || p.sku.includes(String(blingProductId)));

  if (product) {
    await db.update(products).set({ stock: Math.floor(newStock) }).where(eq(products.id, product.id));
    return { success: true, message: `Stock updated for product ${product.sku}: ${newStock}` };
  }

  return { success: true, message: `Product ${blingProductId} not found for stock update` };
}
