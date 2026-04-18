import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageStateError } from './page-state-error';
import { renderWithAppProviders } from '../../test/render';

describe('PageStateError', () => {
  it('renders title and description', () => {
    renderWithAppProviders(
      <PageStateError title="Load failed" description="Try again later" />,
    );

    expect(screen.getByText('Load failed')).toBeInTheDocument();
    expect(screen.getByText('Try again later')).toBeInTheDocument();
  });
});
