import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';
import { renderWithAppProviders } from '../../test/render';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithAppProviders(
      <ConfirmDialog open={false} title="Delete" onConfirm={() => undefined} onCancel={() => undefined} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('fires confirm and cancel callbacks', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    renderWithAppProviders(
      <ConfirmDialog open title="Delete" onConfirm={onConfirm} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
