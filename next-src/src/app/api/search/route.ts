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
    const scored = results.map(t => {
      let score = 0;
      const nameLower = t.name.toLowerCase();
      const descLower = t.desc.toLowerCase();

      if (nameLower === q) score += 100;
      else if (nameLower.startsWith(q)) score += 50;
      else if (nameLower.includes(q)) score += 30;
      if (descLower.includes(q)) score += 10;
      if (t.tags?.some(tag => tag.includes(q))) score += 5;
      if (t.status === 'hot') score += 3;

      return { ...t, _score: score };
    }).filter(t => t._score > 0);

    scored.sort((a, b) => b._score - a._score);
    return scored;
  }

  return results.map(t => ({ ...t, _score: 0 }));
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
    results: paged.map(({ _score, ...rest }) => {
      void _score;
      return rest;
    }),
    facets: { categories: categoryFacets, price: priceFacets },
  });
}
