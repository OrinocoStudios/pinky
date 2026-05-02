import { fireEvent, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ScopeSelector } from './scope-selector';
import { useScope } from '../app/scope-context';
import { renderWithAppProviders } from '../test/render';

function ScopeDebug() {
  const { scope } = useScope();
  const location = useLocation();

  return (
    <div>
      <span data-testid="scope-value">{`${scope.tenantId}/${scope.libraryId}`}</span>
      <span data-testid="search-value">{location.search}</span>
    </div>
  );
}

describe('ScopeSelector', () => {
  it('hydrates scope from URL and updates search params', () => {
    renderWithAppProviders(
      <>
        <ScopeSelector />
        <ScopeDebug />
      </>,
      { initialEntries: ['/?tenantId=tenant-a&libraryId=library-a'] },
    );

    expect(screen.getByDisplayValue('tenant-a')).toBeInTheDocument();
    expect(screen.getByDisplayValue('library-a')).toBeInTheDocument();
    expect(screen.getByTestId('scope-value')).toHaveTextContent('tenant-a/library-a');

    fireEvent.change(screen.getByPlaceholderText('library-01'), { target: { value: 'library-b' } });

    expect(screen.getByTestId('scope-value')).toHaveTextContent('tenant-a/library-b');
    expect(screen.getByTestId('search-value')).toHaveTextContent('?tenantId=tenant-a&libraryId=library-b');
  });

  it('resets scope to global', () => {
    renderWithAppProviders(
      <>
        <ScopeSelector />
        <ScopeDebug />
      </>,
      { initialEntries: ['/?tenantId=tenant-a&libraryId=library-a'] },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    expect(screen.getByTestId('scope-value')).toHaveTextContent('/');
    expect(screen.getByTestId('search-value')).toHaveTextContent('');
  });
});
