import type {
  ResumeDocumentV1,
  ResumeEducation,
  ResumeExperience,
  ResumeProfile,
  ResumeProject,
} from './types';

const CURRENT_SCHEMA_VERSION = 1;
const MAX_STRING_LENGTH = 10_000;
const MAX_ITEMS_PER_SECTION = 100;

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
  const candidate = stringValue(value).slice(0, 128);
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
      return createEmptyResume();
  }
}
