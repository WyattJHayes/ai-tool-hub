import type { Metadata } from 'next';
import { ResumeWorkspace } from '@/components/resume/ResumeWorkspace';

export const metadata: Metadata = {
  title: 'AI 简历优化 - AI Tool Hub',
  description: '在浏览器中本地编辑、导入、实时预览并导出专业简历。',
  alternates: {
    canonical: '/resume/',
  },
};

export default function ResumePage() {
  return <ResumeWorkspace />;
}
