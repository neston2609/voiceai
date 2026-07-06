import { v4 as uuid } from "uuid";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import pg from "pg";
import * as XLSX from "xlsx";
import type { KnowledgeBase, KnowledgeChunk } from "../../types.js";

const { Client } = pg;
const VECTOR_DIMENSIONS = 64;

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index++) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function embedText(text: string) {
  const vector = Array.from({ length: VECTOR_DIMENSIONS }, () => 0);
  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 1);
  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % VECTOR_DIMENSIONS;
    vector[index] += hash & 1 ? 1 : -1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map((value) => Number((value / magnitude).toFixed(6))) : vector;
}

function cosineSimilarity(left: number[] | undefined, right: number[]) {
  if (!left?.length || !right.length) return 0;
  const size = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < size; index++) score += left[index] * right[index];
  return score;
}

export function chunkText(text: string, sourceRef?: string): KnowledgeChunk[] {
  const normalized = text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const chunks: KnowledgeChunk[] = [];
  const max = 1400;
  for (let index = 0; index < normalized.length; index += max) {
    const slice = normalized.slice(index, index + max).trim();
    if (slice) chunks.push({ id: `chunk_${uuid().slice(0, 8)}`, text: slice, sourceRef, embedding: embedText(slice), createdAt: new Date().toISOString() });
  }
  return chunks;
}

export async function extractFileText(input: { fileName: string; mimeType?: string; base64: string }) {
  const buffer = Buffer.from(input.base64, "base64");
  const lower = input.fileName.toLowerCase();
  if (lower.endsWith(".pdf") || input.mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    return parsed.text;
  }
  if (lower.endsWith(".docx") || input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value;
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv") || input.mimeType?.includes("spreadsheet") || input.mimeType === "text/csv") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      return [`Sheet: ${sheetName}`, ...rows.map((row, index) => `row ${index + 1}: ${JSON.stringify(row)}`)].join("\n");
    }).join("\n\n");
  }
  return buffer.toString("utf8");
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html: string, pageUrl: URL, origin: string) {
  const links = new Set<string>();
  const matches = html.matchAll(/href\s*=\s*["']([^"']+)["']/gi);
  for (const match of matches) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    try {
      const next = new URL(href, pageUrl);
      next.hash = "";
      if (next.origin === origin && /^https?:$/.test(next.protocol)) links.add(next.toString());
    } catch {
      continue;
    }
  }
  return Array.from(links);
}

async function fetchWebsitePage(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "VoiceAI-KB-Crawler/1.0" } });
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
  return response.text();
}

export async function crawlWebsiteText(url: string, maxPages = 30) {
  const start = new URL(url);
  const origin = start.origin;
  const queue = [start.toString()];
  const visited = new Set<string>();
  const pages: Array<{ url: string; text: string }> = [];
  while (queue.length && visited.size < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    try {
      const html = await fetchWebsitePage(current);
      const pageUrl = new URL(current);
      const text = htmlToText(html);
      if (text) pages.push({ url: current, text });
      for (const link of extractLinks(html, pageUrl, origin)) {
        if (!visited.has(link) && !queue.includes(link) && visited.size + queue.length < maxPages * 2) queue.push(link);
      }
    } catch {
      continue;
    }
  }
  if (!pages.length) throw new Error("No website text content was extracted.");
  return {
    text: pages.map((page) => `[${page.url}]\n${page.text}`).join("\n\n"),
    pages: pages.map((page) => page.url)
  };
}

export async function loadDatabaseText(input: { connectionString: string; table?: string; query?: string; limit?: number }) {
  const client = new Client({ connectionString: input.connectionString });
  await client.connect();
  try {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 1000);
    const sql = input.query?.trim() || (input.table ? `select * from ${quoteTable(input.table)} limit ${limit}` : "");
    if (!sql) throw new Error("Database ingestion requires a table or query.");
    const result = await client.query(sql);
    return result.rows.map((row, index) => `row ${index + 1}: ${JSON.stringify(row)}`).join("\n");
  } finally {
    await client.end();
  }
}

function quoteTable(table: string) {
  return table.split(".").map((part) => `"${part.replace(/"/g, "\"\"")}"`).join(".");
}

export function retrieveKnowledgeContext(knowledgeBases: KnowledgeBase[], ids: string[] | undefined, query: string) {
  const selected = ids?.length ? knowledgeBases.filter((kb) => ids.includes(kb.id)) : knowledgeBases.filter((kb) => kb.status === "ready");
  const queryEmbedding = embedText(query);
  const chunks = selected.flatMap((kb) => kb.chunks.map((chunk) => ({ kb, chunk, score: cosineSimilarity(chunk.embedding ?? embedText(chunk.text), queryEmbedding) })));
  return chunks
    .filter((item) => item.score > 0 || !query.trim())
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((item, index) => `[KB ${index + 1}: ${item.kb.name}${item.chunk.sourceRef ? ` / ${item.chunk.sourceRef}` : ""}]\n${item.chunk.text}`)
    .join("\n\n");
}
