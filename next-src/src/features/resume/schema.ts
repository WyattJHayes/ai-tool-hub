import type {
  AIOptimizationResult,
  JDAnalysis,
  ResumeDocumentV1,
  ResumeEducation,
  ResumeExperience,
  ResumeProfile,
  ResumeProject,
} from './types';

const CURRENT_SCHEMA_VERSION = 1;
const MAX_STRING_LENGTH = 10_000;
const MAX_ITEMS_PER_SECTION = 100;
const MAX_ID_LENGTH = 128;

type IdFactory = () => string;
type UnknownRecord = Record<string, unknown>;

export class ResumeSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeSchemaError';
  }
}

function generateId(): string {
  return globalThis.crypto.randomUUID();
}

function ownValue(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, MAX_STRING_LENGTH) : fallback;
}

function uniqueId(value: unknown, usedIds: Set<string>, makeId: IdFactory): string {
  const candidate = stringValue(value).slice(0, MAX_ID_LENGTH);
  if (candidate && !usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }

  let generated = makeId();
  while (usedIds.has(generated)) generated = makeId();
  usedIds.add(generated);
  return generated;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_ITEMS_PER_SECTION)
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.slice(0, MAX_STRING_LENGTH));
}

function normalizeProfile(value: unknown, usedIds: Set<string>, makeId: IdFactory): ResumeProfile {
  return {
    id: uniqueId(ownValue(value, 'id'), usedIds, makeId),
    fullName: stringValue(ownValue(value, 'fullName')),
    phone: stringValue(ownValue(value, 'phone')),
    email: stringValue(ownValue(value, 'email')),
    location: stringValue(ownValue(value, 'location')),
    title: stringValue(ownValue(value, 'title')),
  };
}

function normalizeExperience(value: unknown, usedIds: Set<string>, makeId: IdFactory): ResumeExperience {
  return {
    id: uniqueId(ownValue(value, 'id'), usedIds, makeId),
    company: stringValue(ownValue(value, 'company')),
    role: stringValue(ownValue(value, 'role')),
    startDate: stringValue(ownValue(value, 'startDate')),
    endDate: stringValue(ownValue(value, 'endDate')),
    description: stringValue(ownValue(value, 'description')),
  };
}

function normalizeProject(value: unknown, usedIds: Set<string>, makeId: IdFactory): ResumeProject {
  return {
    id: uniqueId(ownValue(value, 'id'), usedIds, makeId),
    name: stringValue(ownValue(value, 'name')),
    role: stringValue(ownValue(value, 'role')),
    startDate: stringValue(ownValue(value, 'startDate')),
    endDate: stringValue(ownValue(value, 'endDate')),
    description: stringValue(ownValue(value, 'description')),
  };
}

function normalizeEducation(value: unknown, usedIds: Set<string>, makeId: IdFactory): ResumeEducation {
  return {
    id: uniqueId(ownValue(value, 'id'), usedIds, makeId),
    school: stringValue(ownValue(value, 'school')),
    major: stringValue(ownValue(value, 'major')),
    degree: stringValue(ownValue(value, 'degree')),
    startDate: stringValue(ownValue(value, 'startDate')),
    endDate: stringValue(ownValue(value, 'endDate')),
  };
}

function normalizeList<T>(value: unknown, normalizeItem: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.slice(0, MAX_ITEMS_PER_SECTION).map(normalizeItem) : [];
}

function normalizeV1(value: UnknownRecord): ResumeDocumentV1 {
  const usedIds = new Set<string>();
  return {
    schemaVersion: 1,
    id: uniqueId(ownValue(value, 'id'), usedIds, generateId),
    name: stringValue(ownValue(value, 'name'), 'Untitled resume'),
    templateId: ownValue(value, 'templateId') === 'classic' ? 'classic' : 'precision',
    profile: normalizeProfile(ownValue(value, 'profile'), usedIds, generateId),
    target: stringValue(ownValue(value, 'target')),
    summary: stringValue(ownValue(value, 'summary')),
    experience: normalizeList(ownValue(value, 'experience'), item => normalizeExperience(item, usedIds, generateId)),
    projects: normalizeList(ownValue(value, 'projects'), item => normalizeProject(item, usedIds, generateId)),
    education: normalizeList(ownValue(value, 'education'), item => normalizeEducation(item, usedIds, generateId)),
    skills: stringList(ownValue(value, 'skills')),
    certificates: stringList(ownValue(value, 'certificates')),
    updatedAt: stringValue(ownValue(value, 'updatedAt'), new Date().toISOString()),
  };
}

export function createEmptyResume(makeId: IdFactory = generateId): ResumeDocumentV1 {
  return {
    schemaVersion: 1,
    id: makeId(),
    name: 'Untitled resume',
    templateId: 'precision',
    profile: { id: makeId(), fullName: '', phone: '', email: '', location: '', title: '' },
    target: '',
    summary: '',
    experience: [],
    projects: [],
    education: [],
    skills: [],
    certificates: [],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeResumeDocument(input: unknown): ResumeDocumentV1 {
  const version = ownValue(input, 'schemaVersion');
  switch (version) {
    case CURRENT_SCHEMA_VERSION:
      return normalizeV1(input as UnknownRecord);
    default:
      if (typeof version === 'number' && version > CURRENT_SCHEMA_VERSION) {
        throw new ResumeSchemaError(`Unsupported resume schema version: ${version}`);
      }
      throw new ResumeSchemaError(`Unrecognized resume schema version: ${String(version)}`);
  }
}

function strictRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ResumeSchemaError('Invalid object.');
  return value as UnknownRecord;
}

function strictString(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_STRING_LENGTH) throw new ResumeSchemaError('Invalid string.');
  return value;
}

function strictNumber(value: unknown, minimum = 0, maximum = 100): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ResumeSchemaError('Invalid number.');
  }
  return value;
}

function strictStringList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS_PER_SECTION) throw new ResumeSchemaError('Invalid list.');
  return value.map(strictString);
}

/**
 * Validates an id and keeps it unique within one document. Upstream models
 * reuse a literal id across items, so a collision is replaced rather than
 * rejected: the value is well-formed, only its uniqueness is not. Length is
 * capped like the normalize path so both validators bound ids identically.
 */
function strictUniqueId(value: unknown, usedIds: Set<string>): string {
  const id = strictString(value).slice(0, MAX_ID_LENGTH);
  if (id && !usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }
  let generated = generateId();
  while (usedIds.has(generated)) generated = generateId();
  usedIds.add(generated);
  return generated;
}

function strictProfile(value: unknown, usedIds: Set<string>): ResumeProfile {
  const record = strictRecord(value);
  return {
    id: strictUniqueId(record.id, usedIds),
    fullName: strictString(record.fullName),
    phone: strictString(record.phone),
    email: strictString(record.email),
    location: strictString(record.location),
    title: strictString(record.title),
  };
}

function strictExperience(value: unknown, usedIds: Set<string>): ResumeExperience {
  const record = strictRecord(value);
  return {
    id: strictUniqueId(record.id, usedIds),
    company: strictString(record.company),
    role: strictString(record.role),
    startDate: strictString(record.startDate),
    endDate: strictString(record.endDate),
    description: strictString(record.description),
  };
}

function strictProject(value: unknown, usedIds: Set<string>): ResumeProject {
  const record = strictRecord(value);
  return {
    id: strictUniqueId(record.id, usedIds),
    name: strictString(record.name),
    role: strictString(record.role),
    startDate: strictString(record.startDate),
    endDate: strictString(record.endDate),
    description: strictString(record.description),
  };
}

function strictEducation(value: unknown, usedIds: Set<string>): ResumeEducation {
  const record = strictRecord(value);
  return {
    id: strictUniqueId(record.id, usedIds),
    school: strictString(record.school),
    major: strictString(record.major),
    degree: strictString(record.degree),
    startDate: strictString(record.startDate),
    endDate: strictString(record.endDate),
  };
}

function strictList<T>(value: unknown, parser: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS_PER_SECTION) throw new ResumeSchemaError('Invalid list.');
  return value.map(parser);
}

export function parseResumeDocument(input: unknown): ResumeDocumentV1 {
  const record = strictRecord(input);
  if (record.schemaVersion !== 1) throw new ResumeSchemaError('Invalid schema version.');
  if (record.templateId !== 'precision' && record.templateId !== 'classic') {
    throw new ResumeSchemaError('Invalid template.');
  }
  const usedIds = new Set<string>();
  return {
    schemaVersion: 1,
    id: strictUniqueId(record.id, usedIds),
    name: strictString(record.name),
    templateId: record.templateId,
    profile: strictProfile(record.profile, usedIds),
    target: strictString(record.target),
    summary: strictString(record.summary),
    experience: strictList(record.experience, item => strictExperience(item, usedIds)),
    projects: strictList(record.projects, item => strictProject(item, usedIds)),
    education: strictList(record.education, item => strictEducation(item, usedIds)),
    skills: strictStringList(record.skills),
    certificates: strictStringList(record.certificates),
    updatedAt: strictString(record.updatedAt),
  };
}

export function parseJDAnalysis(input: unknown): JDAnalysis {
  const record = strictRecord(input);
  if (typeof record.matchDifficulty !== 'string' || !['easy', 'medium', 'hard'].includes(record.matchDifficulty)) {
    throw new ResumeSchemaError('Invalid match difficulty.');
  }
  return {
    jobTitle: strictString(record.jobTitle),
    requiredSkills: strictStringList(record.requiredSkills),
    preferredSkills: strictStringList(record.preferredSkills),
    experienceYears: strictNumber(record.experienceYears, 0, 100),
    education: strictString(record.education),
    responsibilities: strictStringList(record.responsibilities),
    keywords: strictStringList(record.keywords),
    industry: strictString(record.industry),
    companyType: strictString(record.companyType),
    matchDifficulty: record.matchDifficulty as JDAnalysis['matchDifficulty'],
  };
}

export function parseAIOptimizationResult(input: unknown): AIOptimizationResult {
  const record = strictRecord(input);
  if (typeof record.level !== 'string' || !['light', 'medium', 'deep'].includes(record.level)) {
    throw new ResumeSchemaError('Invalid optimization level.');
  }
  const result: AIOptimizationResult = {
    level: record.level as AIOptimizationResult['level'],
    optimizedData: parseResumeDocument(record.optimizedData),
    score: strictNumber(record.score),
    suggestions: strictStringList(record.suggestions),
  };
  for (const key of ['jdMatch', 'atsScore'] as const) {
    if (record[key] !== undefined) result[key] = strictNumber(record[key]);
  }
  for (const key of ['starApplications', 'keywordsOptimized'] as const) {
    if (record[key] !== undefined) result[key] = strictNumber(record[key], 0, 10_000);
  }
  if (record.brandPosition !== undefined) result.brandPosition = strictString(record.brandPosition);
  for (const key of ['keywordsAdded', 'quantifiedItems', 'changes'] as const) {
    if (record[key] !== undefined) result[key] = strictStringList(record[key]);
  }
  return result;
}
