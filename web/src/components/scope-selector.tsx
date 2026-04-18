import { ChangeEvent } from 'react';
import { useScope } from '../app/scope-context';
import { hasScope } from '../lib/scope';

export function ScopeSelector() {
  const { scope, setScope, resetScope } = useScope();

  function handleTenantChange(event: ChangeEvent<HTMLInputElement>) {
    setScope({ tenantId: event.target.value });
  }

  function handleLibraryChange(event: ChangeEvent<HTMLInputElement>) {
    setScope({ libraryId: event.target.value });
  }

  return (
    <section className="scope-panel">
      <div>
        <p className="eyebrow">Scope</p>
        <h2 className="scope-title">Tenant / Library</h2>
      </div>

      <div className="scope-fields">
        <label className="scope-field">
          <span>Tenant</span>
          <input
            className="search-input scope-input"
            placeholder="tenant-a"
            value={scope.tenantId}
            onChange={handleTenantChange}
          />
        </label>

        <label className="scope-field">
          <span>Library</span>
          <input
            className="search-input scope-input"
            placeholder="library-01"
            value={scope.libraryId}
            onChange={handleLibraryChange}
          />
        </label>
      </div>

      <div className="scope-actions">
        <span className="muted-text">{hasScope(scope) ? 'Scoped requests enabled' : 'Global scope'}</span>
        <button className="secondary-button" type="button" onClick={resetScope} disabled={!hasScope(scope)}>
          Reset scope
        </button>
      </div>
    </section>
  );
}
