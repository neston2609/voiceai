import { v4 as uuid } from "uuid";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import pg from "pg";
import type { KnowledgeBase, KnowledgeChunk } from "../../types.js";

const { Client } = pg;

export function chunkText(text: string, sourceRef?: string): KnowledgeChunk[] {
  const normalized = text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const chunks: KnowledgeChunk[] = [];
  const max = 1400;
  for (let index = 0; index < normalized.length; index += max) {
    const slice = normalized.slice(index, index + max).trim();
    if (slice) chunks.push({ id: `chunk_${uuid().slice(0, 8)}`, text: slice, sourceRef, createdAt: new Date().toISOString() });
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
  return buffer.toString("utf8");
}

export async function scrapeWebsiteText(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
  const html = await response.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
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

function scoreChunk(chunk: KnowledgeChunk, query: string) {
  const words = new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1));
  const lower = chunk.text.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (lower.includes(word)) score += 1;
  }
  return score;
}

export function retrieveKnowledgeContext(knowledgeBases: KnowledgeBase[], ids: string[] | undefined, query: string) {
  const selected = ids?.length ? knowledgeBases.filter((kb) => ids.includes(kb.id)) : knowledgeBases.filter((kb) => kb.status === "ready");
  const chunks = selected.flatMap((kb) => kb.chunks.map((chunk) => ({ kb, chunk, score: scoreChunk(chunk, query) })));
  return chunks
    .filter((item) => item.score > 0 || !query.trim())
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((item, index) => `[KB ${index + 1}: ${item.kb.name}${item.chunk.sourceRef ? ` / ${item.chunk.sourceRef}` : ""}]\n${item.chunk.text}`)
    .join("\n\n");
}
