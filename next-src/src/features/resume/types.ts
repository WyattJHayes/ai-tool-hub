export type ResumeSectionKey =
  | 'profile'
  | 'target'
  | 'summary'
  | 'experience'
  | 'projects'
  | 'education'
  | 'skills'
  | 'certificates';

export type OptimizationLevel = 'light' | 'medium' | 'deep';

export interface JDAnalysis {
  jobTitle: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears: number;
  education: string;
  responsibilities: string[];
  keywords: string[];
  industry: string;
  companyType: string;
  matchDifficulty: 'easy' | 'medium' | 'hard';
}

export interface AIProgress {
  status: 'analyzing' | 'optimizing';
  level: OptimizationLevel;
}

export interface AIOptimizationResult {
  level: OptimizationLevel;
  optimizedData: ResumeDocumentV1;
  score: number;
  suggestions: string[];
  jdMatch?: number;
  atsScore?: number;
  brandPosition?: string;
  starApplications?: number;
  keywordsOptimized?: number;
  keywordsAdded?: string[];
  quantifiedItems?: string[];
  changes?: string[];
}

export type AIStreamEvent =
  | { type: 'progress'; data: AIProgress }
  | { type: 'token'; data: { content: string } }
  | { type: 'done'; data: AIOptimizationResult }
  | { type: 'error'; data: { error: { code: string; message: string; requestId: string } } };

export interface ResumeQuotaSummary {
  plan: 'free' | 'basic' | 'vip';
  remaining: number | null;
  total: number | null;
  resetAt: string | null;
}

export interface ResumeItem {
  id: string;
}

export interface ResumeProfile extends ResumeItem {
  fullName: string;
  phone: string;
  email: string;
  location: string;
  title: string;
}

export interface ResumeExperience extends ResumeItem {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeProject extends ResumeItem {
  name: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeEducation extends ResumeItem {
  school: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
}

export interface ResumeDocumentV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  templateId: 'precision' | 'classic';
  profile: ResumeProfile;
  target: string;
  summary: string;
  experience: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  skills: string[];
  certificates: string[];
  updatedAt: string;
}

export interface ResumeChange {
  id: string;
  section: ResumeSectionKey;
  itemId?: string;
  field: string;
  before: string;
  after: string;
  accepted: boolean;
}
