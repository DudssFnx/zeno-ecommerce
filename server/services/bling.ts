import {
  blingTokens,
  categories,
  products,
  type InsertProduct,
} from "@shared/schema";
import crypto from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";

const BLING_API_BASE = "https://api.bling.com.br/Api/v3";
const BLING_OAUTH_URL = "https://www.bling.com.br/Api/v3/oauth";

// Encryption key for tokens (uses SESSION_SECRET as base)
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SESSION_SECRET || "bling-token-encryption-key",
  "salt",
  32,
);

function encryptToken(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptToken(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(":");
    if (!ivHex || !encrypted) return encryptedText; // Return as-is if not encrypted
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedText; // Return as-is if decryption fails
  }
}

interface BlingTokensResponse {
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
  precoCusto?: number;
  tipo: string;
  situacao: string;
  formato?: string;
  descricaoCurta?: string;
  imagemURL?: string;
  estoque?: {
    saldoVirtualTotal?: number;
    saldoFisicoTotal?: number;
  };
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
  categoriaPai?: {
    id: number;
    descricao?: string;
  };
}

let cachedTokens: BlingTokensResponse | null = null;
let tokenExpiresAt: number = 0;
let isRefreshing: boolean = false;
let refreshPromise: Promise<BlingTokensResponse> | null = null;

// ========== TOKEN PERSISTENCE ==========

export async function saveTokensToDb(
  tokens: BlingTokensResponse,
  companyId?: string,
): Promise<void> {
  try {
    // Persist expiresAt as integer (UNIX seconds) to match DB integer column and be robust
    const expiresAtSeconds = Math.floor(Date.now() / 1000 + (tokens.expires_in || 0));

    // Delete old tokens for the company (if companyId provided) or delete all
    if (companyId) {
      await db.delete(blingTokens).where(eq(blingTokens.companyId, companyId));
    } else {
      await db.delete(blingTokens);
    }

    await db.insert(blingTokens).values({
      companyId: companyId || null,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      expiresAt: expiresAtSeconds,
      tokenType: tokens.token_type || "Bearer",
    });

    console.log(
      "[Bling] Tokens saved to database for company:",
      companyId || "global",
      "Expires at (unix secs):",
      expiresAtSeconds,
    );
  } catch (error) {
    console.error("[Bling] Failed to save tokens to database:", error);
  }
}

async function loadTokensFromDb(): Promise<BlingTokensResponse | null> {
  try {
    const rows = await db
      .select()
      .from(blingTokens)
      .orderBy(desc(blingTokens.id))
      .limit(1);

    if (rows.length === 0) {
      console.log("[Bling] No tokens found in database");
      return null;
    }

    const row = rows[0];
    const accessToken = decryptToken(row.accessToken);
    const refreshToken = decryptToken(row.refreshToken);

    // Row.expiresAt may be an integer (unix seconds) or a Date — handle both
    let expiresAtMs: number;
    if (typeof row.expiresAt === "number") {
      // If suspiciously large, assume milliseconds; otherwise seconds.
      expiresAtMs = row.expiresAt > 1e12 ? row.expiresAt : row.expiresAt * 1000;
    } else if (row.expiresAt instanceof Date) {
      expiresAtMs = row.expiresAt.getTime();
    } else {
      // Fallback: try to parse
      const parsed = Number(row.expiresAt);
      expiresAtMs = isNaN(parsed) ? 0 : (parsed > 1e12 ? parsed : parsed * 1000);
    }

    const expiresIn = Math.floor((expiresAtMs - Date.now()) / 1000);

    console.log(
      "[Bling] Tokens loaded from database. Expires in:",
      expiresIn,
      "seconds",
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn > 0 ? expiresIn : 0,
      token_type: row.tokenType,
    };
  } catch (error) {
    console.error("[Bling] Failed to load tokens from database:", error);
    return null;
  }
}

export async function initializeBlingTokens(): Promise<boolean> {
  console.log("[Bling] Initializing tokens from database...");

  const tokens = await loadTokensFromDb();

  if (!tokens) {
    console.log("[Bling] No stored tokens found. Authorization required.");
    return false;
  }

  // Set in memory
  cachedTokens = tokens;
  tokenExpiresAt = Date.now() + tokens.expires_in * 1000 - 120000;

  // Also set in environment for compatibility
  process.env.BLING_ACCESS_TOKEN = tokens.access_token;
  process.env.BLING_REFRESH_TOKEN = tokens.refresh_token;

  // If token is expired or about to expire, refresh it
  if (tokens.expires_in < 300) {
    // Less than 5 minutes
    console.log("[Bling] Token expired or expiring soon, refreshing...");
    try {
      await refreshAccessToken();
      return true;
    } catch (error) {
      console.error("[Bling] Failed to refresh token on init:", error);
      return false;
    }
  }

  console.log("[Bling] Tokens initialized successfully");
  return true;
}

export async function clearBlingTokens(): Promise<void> {
  try {
    await db.delete(blingTokens);
    cachedTokens = null;
    tokenExpiresAt = 0;
    delete process.env.BLING_ACCESS_TOKEN;
    delete process.env.BLING_REFRESH_TOKEN;
    console.log("[Bling] Tokens cleared from database");
  } catch (error) {
    console.error("[Bling] Failed to clear tokens:", error);
  }
}

// ========== SYNC PROGRESS MANAGEMENT ==========
export interface SyncProgress {
  status: "idle" | "running" | "completed" | "error";
  phase: string;
  currentStep: number;
  totalSteps: number;
  message: string;
  created: number;
  updated: number;
  errors: number;
  startTime: number | null;
  estimatedRemaining: string | null;
}

let syncProgress: SyncProgress = {
  status: "idle",
  phase: "",
  currentStep: 0,
  totalSteps: 0,
  message: "",
  created: 0,
  updated: 0,
  errors: 0,
  startTime: null,
  estimatedRemaining: null,
};

const progressListeners: Set<(progress: SyncProgress) => void> = new Set();

export function getSyncProgress(): SyncProgress {
  return { ...syncProgress };
}

export function subscribeSyncProgress(
  callback: (progress: SyncProgress) => void,
): () => void {
  progressListeners.add(callback);
  callback(syncProgress);
  return () => progressListeners.delete(callback);
}

function updateProgress(updates: Partial<SyncProgress>) {
  syncProgress = { ...syncProgress, ...updates };

  if (
    syncProgress.startTime &&
    syncProgress.currentStep > 0 &&
    syncProgress.totalSteps > 0
  ) {
    const elapsed = Date.now() - syncProgress.startTime;
    const avgTimePerStep = elapsed / syncProgress.currentStep;
    const remaining =
      avgTimePerStep * (syncProgress.totalSteps - syncProgress.currentStep);

    if (remaining > 60000) {
      syncProgress.estimatedRemaining = `${Math.ceil(remaining / 60000)} min`;
    } else if (remaining > 0) {
      syncProgress.estimatedRemaining = `${Math.ceil(remaining / 1000)} seg`;
    } else {
      syncProgress.estimatedRemaining = null;
    }
  }

  const snapshot = { ...syncProgress };
  progressListeners.forEach((cb) => cb(snapshot));
}

function resetProgress() {
  syncProgress = {
    status: "idle",
    phase: "",
    currentStep: 0,
    totalSteps: 0,
    message: "",
    created: 0,
    updated: 0,
    errors: 0,
    startTime: null,
    estimatedRemaining: null,
  };
  progressListeners.forEach((cb) => cb(syncProgress));
}

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

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<BlingTokensResponse> {
  const response = await fetch(`${BLING_OAUTH_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${getBasicAuthHeader()}`,
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

  const tokens: BlingTokensResponse = await response.json();
  cachedTokens = tokens;
  tokenExpiresAt = Date.now() + tokens.expires_in * 1000 - 60000;

  process.env.BLING_ACCESS_TOKEN = tokens.access_token;
  process.env.BLING_REFRESH_TOKEN = tokens.refresh_token;

  // Save tokens to database for persistence
  await saveTokensToDb(tokens);

  return tokens;
}

export async function refreshAccessToken(): Promise<BlingTokensResponse> {
  // Prevent concurrent refresh attempts
  if (isRefreshing && refreshPromise) {
    console.log("[Bling] Waiting for ongoing token refresh...");
    return refreshPromise;
  }

  const refreshToken = process.env.BLING_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("No refresh token available. Please re-authorize.");
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      console.log("[Bling] Refreshing access token...");
      const response = await fetch(`${BLING_OAUTH_URL}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${getBasicAuthHeader()}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[Bling] Token refresh error:", error);
        // Clear cached data on refresh failure
        cachedTokens = null;
        tokenExpiresAt = 0;
        throw new Error(`Failed to refresh token: ${response.status}`);
      }

      const tokens: BlingTokensResponse = await response.json();
      cachedTokens = tokens;
      // Set expiration with 2-minute buffer for safety
      tokenExpiresAt = Date.now() + tokens.expires_in * 1000 - 120000;

      process.env.BLING_ACCESS_TOKEN = tokens.access_token;
      process.env.BLING_REFRESH_TOKEN = tokens.refresh_token;

      // Save refreshed tokens to database
      await saveTokensToDb(tokens);

      console.log(
        "[Bling] Token refreshed and saved. Expires at:",
        new Date(tokenExpiresAt).toISOString(),
      );
      return tokens;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function getValidAccessToken(): Promise<string> {
  const accessToken = process.env.BLING_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("Not authenticated with Bling. Please authorize first.");
  }

  // Proactive refresh: if token is close to expiring (within 5 minutes), refresh it now
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (tokenExpiresAt > 0 && tokenExpiresAt - now < fiveMinutes) {
    console.log("[Bling] Token expiring soon, proactively refreshing...");
    try {
      const tokens = await refreshAccessToken();
      return tokens.access_token;
    } catch (error) {
      console.error(
        "[Bling] Proactive refresh failed, using existing token:",
        error,
      );
      // Fall through to use existing token - it might still work
    }
  }

  return accessToken;
}

async function blingApiRequest<T>(endpoint: string): Promise<T> {
  const accessToken = await getValidAccessToken();

  const response = await fetch(`${BLING_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
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

async function blingApiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const accessToken = await getValidAccessToken();

  const response = await fetch(`${BLING_API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    try {
      await refreshAccessToken();
      return blingApiPost<T>(endpoint, body);
    } catch {
      throw new Error("Authentication failed. Please re-authorize with Bling.");
    }
  }

  if (!response.ok) {
    const error = await response.text();
    console.error(`Bling API POST error for ${endpoint}:`, error);
    throw new Error(`Bling API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function fetchBlingProductsList(
  page: number = 1,
  limit: number = 100,
): Promise<BlingProductBasic[]> {
  const response = await blingApiRequest<{ data: BlingProductBasic[] }>(
    `/produtos?pagina=${page}&limite=${limit}&tipo=P&criterio=1`,
  );
  return response.data || [];
}

export async function fetchBlingProductDetails(
  productId: number,
  throwOn429: boolean = false,
): Promise<BlingProductFull | null> {
  try {
    const response = await blingApiRequest<{ data: BlingProductFull }>(
      `/produtos/${productId}`,
    );
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
  const response = await blingApiRequest<{ data: BlingCategory[] }>(
    "/categorias/produtos",
  );
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

interface BlingStockListItem {
  produto: { id: number; codigo?: string };
  deposito?: { id: number; nome?: string };
  saldoFisico?: number;
  saldoVirtual?: number;
}

export async function fetchBlingStock(
  productIds: number[],
): Promise<Map<number, number>> {
  const stockMap = new Map<number, number>();

  console.log(
    `[fetchBlingStock] Starting stock fetch using /estoques endpoint`,
  );

  // Fetch all stock data with pagination
  let page = 1;
  const limit = 100;
  let totalFetched = 0;

  while (true) {
    try {
      const response = await blingApiRequest<{ data: BlingStockListItem[] }>(
        `/estoques?pagina=${page}&limite=${limit}`,
      );

      if (!response.data || response.data.length === 0) {
        console.log(`[fetchBlingStock] No more stock data at page ${page}`);
        break;
      }

      for (const item of response.data) {
        const productId = item.produto?.id;
        if (!productId) continue;

        const stock = item.saldoVirtual ?? item.saldoFisico ?? 0;

        // Sum stock across all deposits for same product
        const currentStock = stockMap.get(productId) || 0;
        stockMap.set(productId, currentStock + Math.floor(stock));
      }

      totalFetched += response.data.length;
      console.log(
        `[fetchBlingStock] Page ${page}: fetched ${response.data.length} stock entries, total: ${totalFetched}`,
      );

      if (response.data.length < limit) {
        break;
      }

      page++;

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      const errorStr = String(error);
      if (errorStr.includes("429")) {
        console.log("[fetchBlingStock] Rate limit hit, waiting 30 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 30000));
        continue;
      } else if (errorStr.includes("404")) {
        console.log(
          "[fetchBlingStock] Stock endpoint returned 404 - module may not be enabled",
        );
        break;
      } else {
        console.error(
          `[fetchBlingStock] Error fetching stock page ${page}:`,
          error,
        );
        break;
      }
    }
  }

  const withStock = Array.from(stockMap.values()).filter((v) => v > 0).length;
  console.log(
    `[fetchBlingStock] Finished. Products with stock data: ${stockMap.size}, with stock > 0: ${withStock}`,
  );

  // Log first 5 products with stock for debugging
  let logged = 0;
  const entries = Array.from(stockMap.entries());
  for (const [productId, stock] of entries) {
    if (stock > 0 && logged < 5) {
      console.log(`[fetchBlingStock] Product ${productId}: stock=${stock}`);
      logged++;
    }
  }

  return stockMap;
}

export async function syncCategories(): Promise<{
  created: number;
  updated: number;
}> {
  const blingCategories = await fetchBlingCategories();
  let created = 0;
  let updated = 0;

  const blingIdToLocalId: Record<number, number> = {};
  const blingCatMap = new Map<number, BlingCategory>();
  blingCategories.forEach((c) => blingCatMap.set(c.id, c));

  function topologicalSort(cats: BlingCategory[]): BlingCategory[] {
    const sorted: BlingCategory[] = [];
    const visited = new Set<number>();

    function visit(cat: BlingCategory) {
      if (visited.has(cat.id)) return;
      visited.add(cat.id);

      const parentBlingId = cat.categoriaPai?.id;
      if (parentBlingId && blingCatMap.has(parentBlingId)) {
        visit(blingCatMap.get(parentBlingId)!);
      }

      sorted.push(cat);
    }

    cats.forEach((c) => visit(c));
    return sorted;
  }

  const sortedCategories = topologicalSort(blingCategories);

  for (const cat of sortedCategories) {
    const slug =
      cat.descricao
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `cat-${cat.id}`;

    const parentBlingId = cat.categoriaPai?.id;
    const parentLocalId = parentBlingId
      ? blingIdToLocalId[parentBlingId] || null
      : null;

    let existing = await db
      .select()
      .from(categories)
      .where(eq(categories.blingId, cat.id))
      .limit(1);

    if (existing.length === 0) {
      existing = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
    }

    if (existing.length === 0) {
      const [newCat] = await db
        .insert(categories)
        .values({
          name: cat.descricao,
          slug,
          parentId: parentLocalId,
          blingId: cat.id,
        })
        .returning();
      blingIdToLocalId[cat.id] = newCat.id;
      created++;
    } else {
      await db
        .update(categories)
        .set({
          name: cat.descricao,
          slug,
          parentId: parentLocalId,
          blingId: cat.id,
        })
        .where(eq(categories.id, existing[0].id));
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
  onProgress?: (completed: number, total: number) => void,
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

  await Promise.all(
    Array(Math.min(concurrency, items.length))
      .fill(0)
      .map(() => worker()),
  );
  return results;
}

async function fetchProductDetailsWithRetry(
  productId: number,
): Promise<BlingProductFull | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await fetchBlingProductDetails(productId, true);
      return result;
    } catch (error) {
      const message = String(error);
      if (message.includes("429")) {
        const waitTime = Math.pow(2, attempt) * 5000 + Math.random() * 1000;
        console.log(
          `Rate limit on product ${productId}, attempt ${attempt + 1}/3, waiting ${(waitTime / 1000).toFixed(1)}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        console.error(`Error fetching product ${productId}:`, message);
        return null;
      }
    }
  }
  console.error(`Failed to fetch product ${productId} after 3 retries`);
  return null;
}

async function fetchProductListWithRetry(
  page: number,
  limit: number,
): Promise<BlingProductBasic[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fetchBlingProductsList(page, limit);
    } catch (error) {
      const message = String(error);
      if (message.includes("429")) {
        const waitTime = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
        console.log(
          `Rate limit on product list page ${page}, attempt ${attempt + 1}/5, waiting ${(waitTime / 1000).toFixed(1)}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
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
        console.log(
          `Rate limit on categories, attempt ${attempt + 1}/5, waiting ${(waitTime / 1000).toFixed(1)}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed to fetch categories after 5 retries");
}

// Sync categories from scratch (used when clearing all data first)
async function syncCategoriesClean(): Promise<{ created: number }> {
  const blingCategories = await fetchCategoriesWithRetry();
  let created = 0;

  const blingIdToLocalId: Record<number, number> = {};
  const blingCatMap = new Map<number, BlingCategory>();
  blingCategories.forEach((c) => blingCatMap.set(c.id, c));

  // Topological sort to process parents before children (subcategories)
  function topologicalSort(cats: BlingCategory[]): BlingCategory[] {
    const sorted: BlingCategory[] = [];
    const visited = new Set<number>();

    function visit(cat: BlingCategory) {
      if (visited.has(cat.id)) return;
      visited.add(cat.id);

      const parentBlingId = cat.categoriaPai?.id;
      if (parentBlingId && blingCatMap.has(parentBlingId)) {
        visit(blingCatMap.get(parentBlingId)!);
      }

      sorted.push(cat);
    }

    cats.forEach((c) => visit(c));
    return sorted;
  }

  const sortedCategories = topologicalSort(blingCategories);
  console.log(
    `Importing ${sortedCategories.length} categories (including subcategories)...`,
  );

  for (const cat of sortedCategories) {
    const slug =
      cat.descricao
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `cat-${cat.id}`;

    const parentBlingId = cat.categoriaPai?.id;
    const parentLocalId = parentBlingId
      ? blingIdToLocalId[parentBlingId] || null
      : null;

    const isSubcategory = !!parentBlingId;
    console.log(
      `Creating category: ${cat.descricao} (blingId: ${cat.id})${isSubcategory ? ` - Subcategory of blingId: ${parentBlingId}` : ""}`,
    );

    const [newCat] = await db
      .insert(categories)
      .values({
        name: cat.descricao,
        slug,
        parentId: parentLocalId,
        blingId: cat.id,
      })
      .returning();

    blingIdToLocalId[cat.id] = newCat.id;
    created++;
  }

  console.log(`Created ${created} categories (including subcategories)`);
  return { created };
}

export async function syncProducts(): Promise<{
  created: number;
  updated: number;
  errors: string[];
}> {
  if (syncProgress.status === "running") {
    throw new Error("Sincronização já em andamento");
  }

  const startTime = Date.now();
  let basicProducts: BlingProductBasic[] = [];
  let page = 1;
  const limit = 100;

  try {
    updateProgress({
      status: "running",
      phase: "Sincronizando categorias",
      currentStep: 0,
      totalSteps: 100,
      message: "Sincronizando categorias do Bling...",
      created: 0,
      updated: 0,
      errors: 0,
      startTime,
    });

    console.log("Syncing categories from Bling...");
    const catResult = await syncCategories();
    console.log(
      `Categories synced: ${catResult.created} created, ${catResult.updated} updated`,
    );

    updateProgress({
      phase: "Buscando lista de produtos",
      message: `Categorias sincronizadas. Buscando produtos...`,
    });

    console.log(
      "Fetching product list from Bling (with rate limit handling)...",
    );
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const pageProducts = await fetchProductListWithRetry(page, limit);
      if (pageProducts.length === 0) break;

      // Import ALL products (active and inactive, with and without stock)
      for (const p of pageProducts) {
        basicProducts.push(p);
      }
      updateProgress({
        message: `Página ${page}: ${basicProducts.length} produtos encontrados`,
      });
      console.log(
        `Page ${page}: ${pageProducts.length} products (${basicProducts.length} total)`,
      );

      if (pageProducts.length < limit) break;
      page++;
    }

    console.log(`Found ${basicProducts.length} products (all).`);
    const totalProducts = basicProducts.length;
    const totalSteps = totalProducts * 2;

    updateProgress({
      phase: "Carregando categorias locais",
      totalSteps,
      message: `${totalProducts} produtos encontrados. Carregando categorias...`,
    });

    const existingCategories = await db.select().from(categories);
    const categoryMap: Record<string, number> = {};
    const blingIdToCategoryId: Record<number, number> = {};
    existingCategories.forEach((c) => {
      categoryMap[c.name.toLowerCase()] = c.id;
      if (c.blingId) {
        blingIdToCategoryId[c.blingId] = c.id;
      }
    });
    console.log(
      `Loaded ${Object.keys(categoryMap).length} local categories with ${Object.keys(blingIdToCategoryId).length} Bling IDs mapped`,
    );

    updateProgress({
      phase: "Buscando detalhes dos produtos",
      message: `Buscando detalhes de ${totalProducts} produtos...`,
    });

    console.log(
      `Fetching product details sequentially (1 req per 600ms = ~1.6 req/s)...`,
    );
    const productIds = basicProducts.map((p) => p.id);
    let detailsFetched = 0;

    const blingProducts = await runWithConcurrency(
      productIds,
      async (id) => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const result = await fetchProductDetailsWithRetry(id);
        detailsFetched++;
        if (detailsFetched % 10 === 0 || detailsFetched === totalProducts) {
          updateProgress({
            currentStep: detailsFetched,
            message: `Buscando detalhes: ${detailsFetched}/${totalProducts}`,
          });
        }
        return result;
      },
      1,
      (done, total) => {
        if (done % 50 === 0)
          console.log(`Fetched ${done}/${total} product details...`);
      },
    );
    console.log(`Fetched all product details.`);

    // Build stock map from basic product listing first (as fallback)
    const stockFromListing = new Map<number, number>();
    for (const bp of basicProducts) {
      const stock =
        bp.estoque?.saldoVirtualTotal ?? bp.estoque?.saldoFisicoTotal ?? 0;
      if (stock > 0) {
        stockFromListing.set(bp.id, stock);
      }
    }
    console.log(
      `[import] Stock from listing: ${stockFromListing.size} products with stock > 0`,
    );

    // Try to fetch from dedicated stock endpoint (may fail if module not enabled)
    updateProgress({
      phase: "Buscando estoque",
      currentStep: totalProducts,
      message: "Buscando estoque dos produtos...",
    });

    console.log(`[import] Fetching stock for ${productIds.length} products...`);
    const stockFromEndpoint = await fetchBlingStock(productIds);
    const nonZeroFromEndpoint = Array.from(stockFromEndpoint.values()).filter(
      (v) => v > 0,
    ).length;
    console.log(
      `[import] Got stock for ${stockFromEndpoint.size} products. Non-zero: ${nonZeroFromEndpoint}`,
    );

    // Merge: prefer endpoint stock, fallback to listing stock
    const stockMap = new Map<number, number>();
    for (const id of productIds) {
      const fromEndpoint = stockFromEndpoint.get(id);
      const fromListing = stockFromListing.get(id);
      stockMap.set(id, fromEndpoint ?? fromListing ?? 0);
    }
    const finalNonZero = Array.from(stockMap.values()).filter(
      (v) => v > 0,
    ).length;
    console.log(
      `[import] Final stock map: ${finalNonZero} products with stock > 0`,
    );

    updateProgress({
      phase: "Salvando produtos",
      message: "Salvando produtos no banco de dados...",
    });

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      const blingProduct = blingProducts[i];

      if (!blingProduct) {
        errors.push(`Product ${productId}: Failed to fetch details`);
        updateProgress({ errors: errors.length });
        continue;
      }

      try {
        let categoryId: number | null = null;
        const blingCat = blingProduct.categoria;
        if (blingCat && blingCat.id) {
          categoryId = blingIdToCategoryId[blingCat.id] || null;
          if (!categoryId && blingCat.descricao) {
            categoryId = categoryMap[blingCat.descricao.toLowerCase()] || null;
          }
          if (!categoryId) {
            console.log(
              `Category not found for product ${blingProduct.codigo}: Bling category ID ${blingCat.id}, desc: ${blingCat.descricao}`,
            );
          }
        }

        let imageUrl: string | null = null;
        if (blingProduct.imagens && blingProduct.imagens.length > 0) {
          const sortedImages = [...blingProduct.imagens].sort(
            (a, b) => (a.ordem || 0) - (b.ordem || 0),
          );
          imageUrl =
            sortedImages[0]?.linkExterno || sortedImages[0]?.link || null;
        }
        if (!imageUrl && blingProduct.midia?.imagens?.externas?.[0]?.link) {
          imageUrl = blingProduct.midia.imagens.externas[0].link;
        }
        if (!imageUrl && blingProduct.midia?.imagens?.internas?.[0]?.link) {
          imageUrl = blingProduct.midia.imagens.internas[0].link;
        }

        const description =
          blingProduct.descricaoComplementar ||
          blingProduct.descricaoCurta ||
          null;
        // Get stock from dedicated stock endpoint (stockMap) - more reliable
        const stock =
          stockMap.get(productId) ??
          blingProduct.estoque?.saldoVirtual ??
          blingProduct.estoque?.saldoFisico ??
          0;

        if (i < 5) {
          console.log(
            `Product ${blingProduct.codigo}: image=${imageUrl ? "YES" : "NO"}, stock=${stock} (from stockMap: ${stockMap.has(productId)}), category=${categoryId}`,
          );
        }

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

        const existing = await db
          .select()
          .from(products)
          .where(eq(products.sku, productData.sku))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(products).values(productData);
          created++;
        } else {
          await db
            .update(products)
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

        if ((i + 1) % 10 === 0 || i === productIds.length - 1) {
          updateProgress({
            currentStep: totalProducts + i + 1,
            created,
            updated,
            message: `Salvando: ${i + 1}/${totalProducts} (${created} novos, ${updated} atualizados)`,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`Product ${productId}: ${message}`);
        updateProgress({ errors: errors.length });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `Sync complete in ${elapsed}s: ${created} created, ${updated} updated, ${errors.length} errors`,
    );

    updateProgress({
      status: "completed",
      phase: "Concluído",
      currentStep: totalSteps,
      message: `Sincronização concluída em ${elapsed}s`,
      created,
      updated,
      errors: errors.length,
      estimatedRemaining: null,
    });

    setTimeout(() => resetProgress(), 30000);

    return { created, updated, errors };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    updateProgress({
      status: "error",
      phase: "Erro",
      message: `Erro: ${message}`,
    });
    setTimeout(() => resetProgress(), 10000);
    throw error;
  }
}

export function isAuthenticated(): boolean {
  return !!process.env.BLING_ACCESS_TOKEN;
}

export function getStatus(): {
  authenticated: boolean;
  hasCredentials: boolean;
} {
  return {
    authenticated: isAuthenticated(),
    hasCredentials: !!(
      process.env.BLING_CLIENT_ID && process.env.BLING_CLIENT_SECRET
    ),
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

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  clientSecret?: string,
): boolean {
  const secret = clientSecret || process.env.BLING_CLIENT_SECRET;
  if (!secret) {
    console.error(
      "BLING_CLIENT_SECRET not configured for webhook verification",
    );
    return false;
  }

  const payloadBuf =
    typeof payload === "string"
      ? Buffer.from(payload, "utf8")
      : (payload as Buffer);
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadBuf)
    .digest("hex");

  // Handle both formats: "sha256=HASH" or just "HASH"
  const normalized = (signature || "").replace(/^sha256=|^SHA256=/i, "");
  try {
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const receivedBuf = Buffer.from(normalized || "", "hex");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch (e) {
    return false;
  }
  const providedHash = signature.replace(/^sha256=/i, "");

  // Ensure both signatures have same length before comparing
  if (expectedSignature.length !== providedHash.length) {
    console.error("Signature length mismatch");
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(providedHash, "hex"),
    );
  } catch (error) {
    console.error("Signature comparison error:", error);
    return false;
  }
}

export async function handleWebhook(
  payload: BlingWebhookPayload,
): Promise<{ success: boolean; message: string }> {
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
        return {
          success: true,
          message: `Event ${event} acknowledged but not processed`,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Webhook processing error for ${event}:`, message);
    return { success: false, message };
  }
}

async function handleProductEvent(
  data: WebhookProductData,
): Promise<{ success: boolean; message: string }> {
  const sku = data.codigo || `BLING-${data.id}`;

  if (data.situacao !== "A") {
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.sku, sku))
      .limit(1);
    if (existing.length > 0) {
      await db.delete(products).where(eq(products.sku, sku));
      return { success: true, message: `Product ${sku} deleted (inactive)` };
    }
    return { success: true, message: `Inactive product ${sku} ignored` };
  }

  // Fetch full product details from Bling API to get image and category
  console.log(`Fetching full details for product ${data.id}...`);
  const fullProduct = await fetchBlingProductDetails(data.id);

  if (!fullProduct) {
    // Fallback to basic webhook data if API call fails
    console.log(`Using fallback webhook data for product ${data.id}`);

    // Try to get category from webhook data
    let categoryId: number | null = null;
    if (data.categoria?.id) {
      const existingCategories = await db.select().from(categories);
      const matchingCategory = existingCategories.find(
        (c) => c.blingId === data.categoria?.id,
      );
      if (matchingCategory) {
        categoryId = matchingCategory.id;
        console.log(
          `Found category ${matchingCategory.name} (blingId: ${data.categoria.id}) for product ${sku}`,
        );
      } else {
        console.log(
          `No matching category found for blingId ${data.categoria.id}`,
        );
      }
    }

    const productData: Partial<InsertProduct> = {
      name: data.nome,
      sku,
      categoryId,
      description: data.descricaoCurta || data.descricaoComplementar || null,
      price: String(data.preco || 0),
      blingId: data.id,
      blingLastSyncedAt: new Date(),
    } as any;

    const existing = await db
      .select()
      .from(products)
      .where(eq(products.sku, sku))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(products).values(productData as InsertProduct);
      return {
        success: true,
        message: `Product ${sku} created (webhook data, categoryId: ${categoryId})`,
      };
    } else {
      await db.update(products).set(productData).where(eq(products.sku, sku));
      return {
        success: true,
        message: `Product ${sku} updated (webhook data, categoryId: ${categoryId})`,
      };
    }
  }

  // Debug: log what Bling API returned for images and stock
  console.log(`Product ${sku} API response:`, {
    imagens: fullProduct.imagens,
    midia: fullProduct.midia,
    estoque: fullProduct.estoque,
  });

  // Extract image URL
  let imageUrl: string | null = null;
  if (fullProduct.imagens && fullProduct.imagens.length > 0) {
    const sortedImages = [...fullProduct.imagens].sort(
      (a, b) => (a.ordem || 0) - (b.ordem || 0),
    );
    imageUrl = sortedImages[0]?.linkExterno || sortedImages[0]?.link || null;
  }
  if (!imageUrl && fullProduct.midia?.imagens?.externas?.[0]?.link) {
    imageUrl = fullProduct.midia.imagens.externas[0].link;
  }
  if (!imageUrl && fullProduct.midia?.imagens?.internas?.[0]?.link) {
    imageUrl = fullProduct.midia.imagens.internas[0].link;
  }

  console.log(`Product ${sku} extracted imageUrl:`, imageUrl);

  // Find category by blingId
  let categoryId: number | null = null;
  if (fullProduct.categoria?.id) {
    const existingCategories = await db.select().from(categories);
    const matchingCategory = existingCategories.find(
      (c) => c.blingId === fullProduct.categoria?.id,
    );
    if (matchingCategory) {
      categoryId = matchingCategory.id;
    }
  }

  const productData: InsertProduct = {
    name: fullProduct.nome,
    sku,
    categoryId,
    brand: fullProduct.marca || null,
    description:
      fullProduct.descricaoComplementar || fullProduct.descricaoCurta || null,
    price: String(fullProduct.preco || 0),
    stock:
      fullProduct.estoque?.saldoVirtual ??
      fullProduct.estoque?.saldoFisico ??
      0,
    image: imageUrl,
    // Link product to Bling
    blingId: fullProduct.id,
    blingLastSyncedAt: new Date(),
  } as any; // cast because InsertProduct type may not include bling fields

  const existing = await db
    .select()
    .from(products)
    .where(eq(products.sku, sku))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(products).values(productData);
    return {
      success: true,
      message: `Product ${sku} created with full details`,
    };
  } else {
    await db
      .update(products)
      .set({
        name: productData.name,
        categoryId: productData.categoryId,
        brand: productData.brand,
        description: productData.description,
        price: productData.price,
        stock: productData.stock,
        image: productData.image,
        blingId: productData.blingId,
        blingLastSyncedAt: productData.blingLastSyncedAt,
      })
      .where(eq(products.sku, sku));
    return {
      success: true,
      message: `Product ${sku} updated with full details`,
    };
  }
}

async function handleProductDeleted(
  blingId: number,
): Promise<{ success: boolean; message: string }> {
  const sku = `BLING-${blingId}`;
  const existing = await db
    .select()
    .from(products)
    .where(eq(products.sku, sku))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(products).where(eq(products.sku, sku));
    return { success: true, message: `Product ${sku} deleted` };
  }

  return { success: true, message: `Product ${blingId} not found locally` };
}

async function handleStockEvent(
  data: WebhookStockData,
): Promise<{ success: boolean; message: string }> {
  const blingProductId = data.produto.id;
  const newStock = data.saldoVirtualTotal;

  // Prefer exact match by blingId for reliability
  const [found] = await db
    .select()
    .from(products)
    .where(eq(products.blingId, blingProductId))
    .limit(1);

  let product = found;

  // Fallback: try matching by SKU patterns
  if (!product) {
    const allProducts = await db.select().from(products);
    product = allProducts.find(
      (p) =>
        p.sku === `BLING-${blingProductId}` ||
        p.sku.includes(String(blingProductId)),
    );
  }

  if (product) {
    await db
      .update(products)
      .set({ stock: Math.floor(newStock) })
      .where(eq(products.id, product.id));
    return {
      success: true,
      message: `Stock updated for product ${product.sku}: ${newStock}`,
    };
  }

  return {
    success: true,
    message: `Product ${blingProductId} not found for stock update`,
  };
}

export async function importBlingProductById(
  productId: number,
  companyId?: string,
): Promise<{ created: boolean; updated: boolean; message?: string }> {
  const fullProduct = await fetchBlingProductDetails(productId);
  if (!fullProduct)
    return { created: false, updated: false, message: "product not found" };

  const sku = fullProduct.codigo || `BLING-${fullProduct.id}`;

  // Extract image URL
  let imageUrl: string | null = null;
  if (fullProduct.imagens && fullProduct.imagens.length > 0) {
    const sortedImages = [...fullProduct.imagens].sort(
      (a, b) => (a.ordem || 0) - (b.ordem || 0),
    );
    imageUrl = sortedImages[0]?.linkExterno || sortedImages[0]?.link || null;
  }
  if (!imageUrl && fullProduct.midia?.imagens?.externas?.[0]?.link) {
    imageUrl = fullProduct.midia.imagens.externas[0].link;
  }
  if (!imageUrl && fullProduct.midia?.imagens?.internas?.[0]?.link) {
    imageUrl = fullProduct.midia.imagens.internas[0].link;
  }

  // Find category by blingId
  let categoryId: number | null = null;
  if (fullProduct.categoria?.id) {
    const existingCategories = await db.select().from(categories);
    const matchingCategory = existingCategories.find(
      (c) => c.blingId === fullProduct.categoria?.id,
    );
    if (matchingCategory) {
      categoryId = matchingCategory.id;
    }
  }

  const productData: any = {
    name: fullProduct.nome,
    sku,
    categoryId,
    brand: fullProduct.marca || null,
    description:
      fullProduct.descricaoComplementar || fullProduct.descricaoCurta || null,
    price: String(fullProduct.preco || 0),
    stock:
      fullProduct.estoque?.saldoVirtual ??
      fullProduct.estoque?.saldoFisico ??
      0,
    image: imageUrl,
    blingId: fullProduct.id,
    blingLastSyncedAt: new Date(),
  };

  const existing = await db
    .select()
    .from(products)
    .where(eq(products.sku, sku))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(products).values(productData);
    return { created: true, updated: false, message: `Product ${sku} created` };
  } else {
    await db
      .update(products)
      .set({
        name: productData.name,
        categoryId: productData.categoryId,
        brand: productData.brand,
        description: productData.description,
        price: productData.price,
        stock: productData.stock,
        image: productData.image,
        blingId: productData.blingId,
        blingLastSyncedAt: productData.blingLastSyncedAt,
      })
      .where(eq(products.sku, sku));
    return { created: false, updated: true, message: `Product ${sku} updated` };
  }
}

export async function importBlingProductsByIds(
  productIds: number[],
  companyId?: string,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const id of productIds) {
    try {
      const result = await importBlingProductById(id, companyId);
      if (result.created) imported++;
      else if (result.updated) skipped++; // treat update as skipped for UX
    } catch (error: any) {
      errors.push(`Product ${id}: ${error?.message || String(error)}`);
    }
    // Basic rate limit friendliness
    await new Promise((r) => setTimeout(r, 300));
  }

  return { imported, skipped, errors };
}

// ========== ORDER CREATION ==========

export interface BlingOrderItem {
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnidade: number;
}

export interface BlingOrderData {
  orderNumber: string;
  customerCpfCnpj?: string;
  customerName?: string;
  items: BlingOrderItem[];
  frete?: number;
  desconto?: number;
  observacoes?: string;
}

interface BlingOrderResponse {
  data: {
    id: number;
    numero?: string;
  };
}

export async function createBlingOrder(
  orderData: BlingOrderData,
): Promise<{ success: boolean; blingId?: number; error?: string }> {
  try {
    const accessToken = process.env.BLING_ACCESS_TOKEN;
    if (!accessToken) {
      console.log("Bling not configured - skipping order sync");
      return { success: false, error: "Bling not configured" };
    }

    const today = new Date().toISOString().split("T")[0];

    const blingPayload: any = {
      data: today,
      dataPrevista: today,
      numeroLoja: orderData.orderNumber,
      observacoes:
        orderData.observacoes || `Pedido #${orderData.orderNumber} do site`,
      itens: orderData.items.map((item) => ({
        codigo: item.codigo,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnidade: item.valorUnidade,
      })),
    };

    if (orderData.customerCpfCnpj) {
      const cleanDoc = orderData.customerCpfCnpj.replace(/\D/g, "");
      blingPayload.contato = {
        tipoPessoa: cleanDoc.length > 11 ? "J" : "F",
        cpfCnpj: cleanDoc,
        nome: orderData.customerName || "Cliente",
      };
    }

    if (orderData.frete && orderData.frete > 0) {
      blingPayload.transporte = {
        valorFrete: orderData.frete,
      };
    }

    if (orderData.desconto && orderData.desconto > 0) {
      blingPayload.desconto = {
        valor: orderData.desconto,
        unidade: "REAL",
      };
    }

    console.log(
      "Sending order to Bling:",
      JSON.stringify(blingPayload, null, 2),
    );

    const response = await blingApiPost<BlingOrderResponse>(
      "/pedidos/vendas",
      blingPayload,
    );

    console.log("Bling order created successfully:", response.data.id);
    return { success: true, blingId: response.data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create Bling order:", message);
    return { success: false, error: message };
  }
}
