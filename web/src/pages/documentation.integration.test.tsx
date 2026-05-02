import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentationPage } from './documentation';
import { renderWithAppProviders } from '../test/render';

describe('DocumentationPage', () => {
  it('renders section selector with three buttons', async () => {
    renderWithAppProviders(<DocumentationPage />);

    await screen.findByText('Documentacion');
    expect(screen.getByRole('tab', { name: 'Despliegue' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Instalacion' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Integracion pinky-mcp' })).toBeInTheDocument();
  });

  it('changes content when selecting another section', async () => {
    renderWithAppProviders(<DocumentationPage />);

    await screen.findByText('Despliegue en entorno productivo');

    fireEvent.click(screen.getByRole('tab', { name: 'Instalacion' }));
    await screen.findByText('Instalacion para desarrollo local');
    expect(screen.getByText('Comandos y estructura del proyecto')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Integracion pinky-mcp' }));
    await screen.findByText('Integracion con pinky-mcp');
    expect(screen.getByText('README de pinky-mcp')).toBeInTheDocument();
  });
});
