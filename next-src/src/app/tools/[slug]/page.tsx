import { ToolDetailClient } from '@/components/tools/ToolDetailClient';

interface ToolDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}

export default async function ToolDetailPage({ params, searchParams }: ToolDetailPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const from = Array.isArray(query.from) ? query.from[0] : query.from;
  return <ToolDetailClient slug={slug} from={from} />;
}
