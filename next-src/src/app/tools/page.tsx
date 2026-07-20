import { Suspense } from 'react';
import { ToolsBrowseClient } from '@/components/tools/ToolsBrowseClient';
import { ToolsPageSkeleton } from '@/components/tools/ToolsPageSkeleton';

export default function ToolsBrowsePage() {
  return (
    <Suspense fallback={<ToolsPageSkeleton />}>
      <ToolsBrowseClient />
    </Suspense>
  );
}
