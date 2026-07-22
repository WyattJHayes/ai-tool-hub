'use client';

import { useCallback, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react';
import { useResumeStore } from '@/features/resume/store';
import type {
  ResumeDocumentV1,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
} from '@/features/resume/types';
import type { ResumeSaveStatus } from './ResumeToolbar';

interface ResumeEditorProps {
  document: ResumeDocumentV1;
  onSaveStatusChange: (status: ResumeSaveStatus) => void;
}

interface EditorSectionProps {
  title: string;
  children: ReactNode;
}

interface RowActionsProps {
  label: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function EditorSection({ title, children }: EditorSectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <section className="resume-editor-section">
      <button
        type="button"
        className="resume-editor-section__toggle"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <span>{title}</span>
        <ChevronDown aria-hidden="true" data-open={open ? 'true' : 'false'} />
      </button>
      {open ? <div className="resume-editor-section__body">{children}</div> : null}
    </section>
  );
}

function RowActions({ label, index, count, onMove, onDuplicate, onDelete }: RowActionsProps) {
  return (
    <div className="resume-row-actions" aria-label={`${label}操作`}>
      <button
        type="button"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label={`上移${label}`}
        title="上移"
      >
        <ArrowUp aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onMove(index, index + 1)}
        disabled={index === count - 1}
        aria-label={`下移${label}`}
        title="下移"
      >
        <ArrowDown aria-hidden="true" />
      </button>
      <button type="button" onClick={onDuplicate} aria-label={`复制${label}`} title="复制">
        <Copy aria-hidden="true" />
      </button>
      <button type="button" onClick={onDelete} aria-label={`删除${label}`} title="删除">
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  );
}

function createItemId(): string {
  return globalThis.crypto.randomUUID();
}

export function ResumeEditor({ document, onSaveStatusChange }: ResumeEditorProps) {
  const saveState = useResumeStore(state => state.saveState);
  const reorderItems = useResumeStore(state => state.reorderItems);
  const duplicateItem = useResumeStore(state => state.duplicateItem);
  const deleteItem = useResumeStore(state => state.deleteItem);

  const commit = useCallback((nextDocument: ResumeDocumentV1) => {
    onSaveStatusChange('saving');
    try {
      saveState(nextDocument);
      onSaveStatusChange('saved');
    } catch {
      onSaveStatusChange('error');
    }
  }, [onSaveStatusChange, saveState]);

  const runStoreAction = useCallback((action: () => void) => {
    onSaveStatusChange('saving');
    try {
      action();
      onSaveStatusChange('saved');
    } catch {
      onSaveStatusChange('error');
    }
  }, [onSaveStatusChange]);

  const updateExperience = (id: string, patch: Partial<ResumeExperience>) => {
    commit({
      ...document,
      experience: document.experience.map(item => item.id === id ? { ...item, ...patch } : item),
    });
  };

  const updateProject = (id: string, patch: Partial<ResumeProject>) => {
    commit({
      ...document,
      projects: document.projects.map(item => item.id === id ? { ...item, ...patch } : item),
    });
  };

  const updateEducation = (id: string, patch: Partial<ResumeEducation>) => {
    commit({
      ...document,
      education: document.education.map(item => item.id === id ? { ...item, ...patch } : item),
    });
  };

  const addExperience = () => commit({
    ...document,
    experience: [...document.experience, {
      id: createItemId(), company: '', role: '', startDate: '', endDate: '', description: '',
    }],
  });

  const addProject = () => commit({
    ...document,
    projects: [...document.projects, {
      id: createItemId(), name: '', role: '', startDate: '', endDate: '', description: '',
    }],
  });

  const addEducation = () => commit({
    ...document,
    education: [...document.education, {
      id: createItemId(), school: '', major: '', degree: '', startDate: '', endDate: '',
    }],
  });

  return (
    <div className="resume-editor" aria-label="简历编辑区">
      <EditorSection title="个人信息">
        <div className="resume-field-grid resume-field-grid--profile">
          <label>姓名<input value={document.profile.fullName} onChange={(event) => commit({ ...document, profile: { ...document.profile, fullName: event.target.value } })} /></label>
          <label>当前职位<input value={document.profile.title} onChange={(event) => commit({ ...document, profile: { ...document.profile, title: event.target.value } })} /></label>
          <label>邮箱<input type="email" value={document.profile.email} onChange={(event) => commit({ ...document, profile: { ...document.profile, email: event.target.value } })} /></label>
          <label>电话<input type="tel" value={document.profile.phone} onChange={(event) => commit({ ...document, profile: { ...document.profile, phone: event.target.value } })} /></label>
          <label className="resume-field-grid__wide">所在地<input value={document.profile.location} onChange={(event) => commit({ ...document, profile: { ...document.profile, location: event.target.value } })} /></label>
        </div>
      </EditorSection>

      <EditorSection title="求职目标">
        <label className="resume-block-field">目标职位<input value={document.target} onChange={(event) => commit({ ...document, target: event.target.value })} /></label>
      </EditorSection>

      <EditorSection title="个人总结">
        <label className="resume-block-field">总结<textarea rows={5} value={document.summary} onChange={(event) => commit({ ...document, summary: event.target.value })} /></label>
      </EditorSection>

      <EditorSection title="工作经历">
        <div className="resume-repeatable-list">
          {document.experience.map((item, index) => (
            <article className="resume-repeatable-row" key={item.id}>
              <div className="resume-repeatable-row__heading">
                <h3>经历 {String(index + 1).padStart(2, '0')}</h3>
                <RowActions
                  label={`工作经历 ${index + 1}`}
                  index={index}
                  count={document.experience.length}
                  onMove={(from, to) => runStoreAction(() => reorderItems('experience', from, to))}
                  onDuplicate={() => runStoreAction(() => duplicateItem('experience', item.id))}
                  onDelete={() => runStoreAction(() => deleteItem('experience', item.id))}
                />
              </div>
              <div className="resume-field-grid">
                <label>公司<input value={item.company} onChange={(event) => updateExperience(item.id, { company: event.target.value })} /></label>
                <label>职位<input value={item.role} onChange={(event) => updateExperience(item.id, { role: event.target.value })} /></label>
                <label>开始时间<input value={item.startDate} onChange={(event) => updateExperience(item.id, { startDate: event.target.value })} /></label>
                <label>结束时间<input value={item.endDate} onChange={(event) => updateExperience(item.id, { endDate: event.target.value })} /></label>
                <label className="resume-field-grid__wide">工作内容<textarea rows={5} value={item.description} onChange={(event) => updateExperience(item.id, { description: event.target.value })} /></label>
              </div>
            </article>
          ))}
        </div>
        <button type="button" className="resume-add-control" onClick={addExperience}><Plus aria-hidden="true" />新增工作经历</button>
      </EditorSection>

      <EditorSection title="项目经历">
        <div className="resume-repeatable-list">
          {document.projects.map((item, index) => (
            <article className="resume-repeatable-row" key={item.id}>
              <div className="resume-repeatable-row__heading">
                <h3>项目 {String(index + 1).padStart(2, '0')}</h3>
                <RowActions
                  label={`项目经历 ${index + 1}`}
                  index={index}
                  count={document.projects.length}
                  onMove={(from, to) => runStoreAction(() => reorderItems('projects', from, to))}
                  onDuplicate={() => runStoreAction(() => duplicateItem('projects', item.id))}
                  onDelete={() => runStoreAction(() => deleteItem('projects', item.id))}
                />
              </div>
              <div className="resume-field-grid">
                <label>项目名称<input value={item.name} onChange={(event) => updateProject(item.id, { name: event.target.value })} /></label>
                <label>项目角色<input value={item.role} onChange={(event) => updateProject(item.id, { role: event.target.value })} /></label>
                <label>开始时间<input value={item.startDate} onChange={(event) => updateProject(item.id, { startDate: event.target.value })} /></label>
                <label>结束时间<input value={item.endDate} onChange={(event) => updateProject(item.id, { endDate: event.target.value })} /></label>
                <label className="resume-field-grid__wide">项目说明<textarea rows={5} value={item.description} onChange={(event) => updateProject(item.id, { description: event.target.value })} /></label>
              </div>
            </article>
          ))}
        </div>
        <button type="button" className="resume-add-control" onClick={addProject}><Plus aria-hidden="true" />新增项目经历</button>
      </EditorSection>

      <EditorSection title="教育经历">
        <div className="resume-repeatable-list">
          {document.education.map((item, index) => (
            <article className="resume-repeatable-row" key={item.id}>
              <div className="resume-repeatable-row__heading">
                <h3>教育 {String(index + 1).padStart(2, '0')}</h3>
                <RowActions
                  label={`教育经历 ${index + 1}`}
                  index={index}
                  count={document.education.length}
                  onMove={(from, to) => runStoreAction(() => reorderItems('education', from, to))}
                  onDuplicate={() => runStoreAction(() => duplicateItem('education', item.id))}
                  onDelete={() => runStoreAction(() => deleteItem('education', item.id))}
                />
              </div>
              <div className="resume-field-grid">
                <label>学校<input value={item.school} onChange={(event) => updateEducation(item.id, { school: event.target.value })} /></label>
                <label>专业<input value={item.major} onChange={(event) => updateEducation(item.id, { major: event.target.value })} /></label>
                <label>学历<input value={item.degree} onChange={(event) => updateEducation(item.id, { degree: event.target.value })} /></label>
                <label>开始时间<input value={item.startDate} onChange={(event) => updateEducation(item.id, { startDate: event.target.value })} /></label>
                <label>结束时间<input value={item.endDate} onChange={(event) => updateEducation(item.id, { endDate: event.target.value })} /></label>
              </div>
            </article>
          ))}
        </div>
        <button type="button" className="resume-add-control" onClick={addEducation}><Plus aria-hidden="true" />新增教育经历</button>
      </EditorSection>

      <EditorSection title="技能">
        <label className="resume-block-field">每行一项<textarea rows={5} value={document.skills.join('\n')} onChange={(event) => commit({ ...document, skills: event.target.value.split('\n') })} /></label>
      </EditorSection>

      <EditorSection title="证书与补充">
        <label className="resume-block-field">每行一项<textarea rows={5} value={document.certificates.join('\n')} onChange={(event) => commit({ ...document, certificates: event.target.value.split('\n') })} /></label>
      </EditorSection>
    </div>
  );
}
