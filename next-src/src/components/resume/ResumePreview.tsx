'use client';

import { forwardRef } from 'react';
import {
  isResumeEducationPopulated,
  isResumeExperiencePopulated,
  isResumeProjectPopulated,
} from '@/features/resume/ui';
import type { ResumeDocumentV1 } from '@/features/resume/types';

interface ResumePreviewProps {
  document: ResumeDocumentV1;
}

function hasText(value: string): boolean {
  return Boolean(value.trim());
}

function dateRange(startDate: string, endDate: string): string {
  return [startDate, endDate].filter(hasText).join(' - ');
}

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  function ResumePreview({ document }, ref) {
    const contacts = [document.profile.email, document.profile.phone, document.profile.location].filter(hasText);
    const displayName = document.profile.fullName.trim() || (
      document.name === 'Untitled resume' ? '未命名简历' : document.name
    );
    const hasTarget = hasText(document.target);
    const hasSummary = hasText(document.summary);
    const experience = document.experience.filter(isResumeExperiencePopulated);
    const projects = document.projects.filter(isResumeProjectPopulated);
    const education = document.education.filter(isResumeEducationPopulated);
    const skills = document.skills.filter(hasText);
    const certificates = document.certificates.filter(hasText);

    return (
      <div className="resume-preview-stage" aria-label="A4 简历实时预览">
        <div className="resume-preview-frame">
          <div
            ref={ref}
            className="resume-preview-document"
            data-template={document.templateId}
          >
            <article className="resume-paper" data-resume-page aria-label="简历第 1 页">
              <header className="resume-paper__header">
                <p className="resume-paper__index">RESUME / 01</p>
                <h1>{displayName}</h1>
                {hasText(document.profile.title) ? <p className="resume-paper__role">{document.profile.title}</p> : null}
                {contacts.length ? (
                  <p className="resume-paper__contacts">
                    {contacts.map((contact, index) => (
                      <span key={`${contact}-${index}`}>{contact}</span>
                    ))}
                  </p>
                ) : null}
              </header>

              {hasTarget ? (
                <section className="resume-paper__section">
                  <h2>求职目标</h2>
                  <p>{document.target}</p>
                </section>
              ) : null}

              {hasSummary ? (
                <section className="resume-paper__section">
                  <h2>个人总结</h2>
                  <p className="resume-paper__prose">{document.summary}</p>
                </section>
              ) : null}

              {experience.length ? (
                <section className="resume-paper__section">
                  <h2>工作经历</h2>
                  <div className="resume-paper__entries">
                    {experience.map(item => (
                      <article className="resume-paper__entry" key={item.id}>
                        <div className="resume-paper__entry-heading">
                          <div>
                            {hasText(item.role) ? <h3>{item.role}</h3> : null}
                            {hasText(item.company) ? <p>{item.company}</p> : null}
                          </div>
                          {hasText(dateRange(item.startDate, item.endDate)) ? <time>{dateRange(item.startDate, item.endDate)}</time> : null}
                        </div>
                        {hasText(item.description) ? <p className="resume-paper__prose">{item.description}</p> : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {projects.length ? (
                <section className="resume-paper__section">
                  <h2>项目经历</h2>
                  <div className="resume-paper__entries">
                    {projects.map(item => (
                      <article className="resume-paper__entry" key={item.id}>
                        <div className="resume-paper__entry-heading">
                          <div>
                            {hasText(item.name) ? <h3>{item.name}</h3> : null}
                            {hasText(item.role) ? <p>{item.role}</p> : null}
                          </div>
                          {hasText(dateRange(item.startDate, item.endDate)) ? <time>{dateRange(item.startDate, item.endDate)}</time> : null}
                        </div>
                        {hasText(item.description) ? <p className="resume-paper__prose">{item.description}</p> : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {education.length ? (
                <section className="resume-paper__section">
                  <h2>教育经历</h2>
                  <div className="resume-paper__entries">
                    {education.map(item => (
                      <article className="resume-paper__entry" key={item.id}>
                        <div className="resume-paper__entry-heading">
                          <div>
                            {hasText(item.school) ? <h3>{item.school}</h3> : null}
                            {[item.degree, item.major].filter(hasText).length ? <p>{[item.degree, item.major].filter(hasText).join(' · ')}</p> : null}
                          </div>
                          {hasText(dateRange(item.startDate, item.endDate)) ? <time>{dateRange(item.startDate, item.endDate)}</time> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {skills.length ? (
                <section className="resume-paper__section">
                  <h2>技能</h2>
                  <p>{skills.join(' · ')}</p>
                </section>
              ) : null}

              {certificates.length ? (
                <section className="resume-paper__section">
                  <h2>证书与补充</h2>
                  <ul>{certificates.map((certificate, index) => <li key={`${certificate}-${index}`}>{certificate}</li>)}</ul>
                </section>
              ) : null}
            </article>
          </div>
        </div>
      </div>
    );
  },
);
