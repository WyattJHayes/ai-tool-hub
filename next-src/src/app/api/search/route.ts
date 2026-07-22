import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

interface SearchTool {
  id: number;
  name: string;
  desc: string;
  category: string;
  categories: string[];
  tags: string[];
  toolTags: string[];
  valueTag?: string;
  status?: string;
}

let toolsCache: SearchTool[] = [];

function loadTools(): SearchTool[] {
  if (toolsCache.length > 0) return toolsCache;
  try {
    const path = join(process.cwd(), 'public/data/tools.json');
    const data = JSON.parse(readFileSync(path, 'utf8'));
    toolsCache = data.tools;
    return toolsCache;
  } catch {
    return [];
  }
}

function scoreTool(tool: SearchTool, query: string) {
  let matchScore = 0;
  const nameLower = tool.name.toLowerCase();
  const descLower = tool.desc.toLowerCase();

  if (nameLower === query) matchScore += 100;
  else if (nameLower.startsWith(query)) matchScore += 50;
  else if (nameLower.includes(query)) matchScore += 30;
  if (descLower.includes(query)) matchScore += 10;
  if (tool.category.toLowerCase().includes(query)) matchScore += 5;
  if (tool.categories?.some(category => category.toLowerCase().includes(query))) matchScore += 5;
  if (tool.tags?.some(tag => tag.toLowerCase().includes(query))) matchScore += 5;
  if (tool.toolTags?.some(tag => tag.toLowerCase().includes(query))) matchScore += 5;
  if (tool.valueTag?.toLowerCase().includes(query)) matchScore += 5;

  return {
    matchScore,
    rankScore: tool.status === 'hot' ? 3 : 0,
  };
}

function searchTools(query: string, category?: string, price?: string, origin?: string) {
  const tools = loadTools();
  const q = query.toLowerCase().trim();

  let results = tools;

  if (category && category !== 'all') {
    results = results.filter(t =>
      t.category === category ||
      (t.categories && t.categories.includes(category))
    );
  }
  if (price) {
    results = results.filter(t => t.tags?.includes(price));
  }
  if (origin) {
    if (origin === 'domestic') results = results.filter(t => t.toolTags?.includes('国产'));
    else if (origin === 'overseas') results = results.filter(t => !t.toolTags?.includes('国产'));
  }

  if (q) {
    const scored = results.map(t => ({ ...t, ...scoreTool(t, q) }))
      .filter(t => t.matchScore > 0);

    scored.sort((a, b) => {
      const scoreDifference = (b.matchScore + b.rankScore) - (a.matchScore + a.rankScore);
      return scoreDifference || a.id - b.id;
    });
    return scored;
  }

  return results.map(t => ({ ...t, matchScore: 0, rankScore: 0 }));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category') || undefined;
  const price = url.searchParams.get('price') || undefined;
  const origin = url.searchParams.get('origin') || undefined;
  const page = Number(url.searchParams.get('page') || '1');
  const limit = Number(url.searchParams.get('limit') || '20');

  const results = searchTools(query, category, price, origin);
  const total = results.length;
  const paged = results.slice((page - 1) * limit, page * limit);

  const allFiltered = query ? results : loadTools();
  const categoryFacets: Record<string, number> = {};
  const priceFacets: Record<string, number> = { free: 0, vip: 0 };

  allFiltered.forEach((t) => {
    const cats = t.categories || [t.category];
    cats.forEach((c: string) => { categoryFacets[c] = (categoryFacets[c] || 0) + 1; });
    if (t.tags?.includes('free')) priceFacets.free++;
    if (t.tags?.includes('vip')) priceFacets.vip++;
  });

  return NextResponse.json({
    query,
    total,
    page,
    limit,
    results: paged.map(({ matchScore, rankScore, ...rest }) => {
      void matchScore;
      void rankScore;
      return rest;
    }),
    facets: { categories: categoryFacets, price: priceFacets },
  });
}
