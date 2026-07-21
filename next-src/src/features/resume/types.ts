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
