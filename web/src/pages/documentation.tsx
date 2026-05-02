import { useMemo, useState } from 'react';
import {
  documentationSections,
  DocumentationSectionId,
} from '../lib/documentation-content';

export function DocumentationPage() {
  const [activeSectionId, setActiveSectionId] = useState<DocumentationSectionId>('deployment');

  const activeSection = useMemo(
    () =>
      documentationSections.find((section) => section.id === activeSectionId) ??
      documentationSections[0],
    [activeSectionId],
  );

  return (
    <div className="page-stack">
      <div>
        <p className="eyebrow">Guias</p>
        <h2 className="page-title">Documentacion</h2>
        <p className="muted-text">
          Elige el flujo que necesitas y sigue los pasos recomendados.
        </p>
      </div>

      <section className="panel docs-selector-panel">
        <div className="docs-selector-buttons" role="tablist" aria-label="Secciones de documentacion">
          {documentationSections.map((section) => (
            <button
              key={section.id}
              className={section.id === activeSection.id ? 'primary-button' : 'secondary-button'}
              type="button"
              role="tab"
              aria-selected={section.id === activeSection.id}
              onClick={() => setActiveSectionId(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </section>

      <article className="panel docs-content-panel" role="tabpanel" aria-label={activeSection.label}>
        <div className="page-stack compact-gap">
          <div className="cell-stack">
            <h3 className="docs-content-title">{activeSection.title}</h3>
            <p className="muted-text">{activeSection.intro}</p>
          </div>

          <ol className="docs-steps">
            {activeSection.steps.map((step) => (
              <li key={step.title} className="docs-step-item">
                <h4 className="docs-step-title">{step.title}</h4>
                <p className="docs-step-description">{step.description}</p>
              </li>
            ))}
          </ol>

          <div className="cell-stack">
            <h4 className="docs-references-title">Referencias</h4>
            <ul className="docs-references-list">
              {activeSection.references.map((reference) => (
                <li key={reference.path}>
                  <a href={`file://${reference.path}`} target="_blank" rel="noreferrer">
                    {reference.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>
    </div>
  );
}
