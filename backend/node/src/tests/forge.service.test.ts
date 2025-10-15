const mockRegion = {
  Us: 'us',
} as const;

/*
 * Copyright (C) 2025 Matheus Piovezan Teixeira
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock das dependências externas
vi.mock('../ws/websocket', () => ({
  ConversionStatus: {
    UPLOADING: 'UPLOADING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR',
  },
  wsManager: {
    updateProgress: vi.fn(),
    completeJob: vi.fn(),
    handleJobError: vi.fn(),
  },
}));

vi.mock('../utils/load-env', () => ({
  env: {
    AUTODESK_CLIENT_ID: 'test-id',
    AUTODESK_CLIENT_SECRET: 'test-secret',
    HOST: 'http://localhost',
    PORT: '3000',
  },
}));

// 1. Declare mock objects
const mockAuthenticationClient = {
  getTwoLeggedToken: vi.fn(),
};

const mockScopes = {
  DataRead: 'data:read',
  DataWrite: 'data:write',
  DataCreate: 'data:create',
  BucketCreate: 'bucket:create',
  BucketRead: 'bucket:read',
} as const;

const mockOssClient = {
  getBucketDetails: vi.fn(),
  createBucket: vi.fn(),
  uploadObject: vi.fn(),
};

const mockModelDerivativeClient = {
  startJob: vi.fn(),
  getManifest: vi.fn(),
  getDerivativeUrl: vi.fn(),
};

const mockAxiosGet = vi.fn();

// 2. Mock the modules using the declared objects
vi.mock('@aps_sdk/authentication', () => ({
  AuthenticationClient: vi.fn(() => mockAuthenticationClient),
  Scopes: mockScopes,
}));

vi.mock('@aps_sdk/oss', () => ({
  OssClient: vi.fn(() => mockOssClient),
  Region: mockRegion,
}));

vi.mock('@aps_sdk/model-derivative', () => ({
  ModelDerivativeClient: vi.fn(() => mockModelDerivativeClient),
}));

vi.mock('axios', () => ({
  default: {
    get: mockAxiosGet,
  },
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 12345 }),
}));

describe('Forge Service (APS)', () => {
  // Dynamically import the service after mocks are set up
  let convertRvtToIfcWS: typeof import('../services/forge.service')['convertRvtToIfcWS'];
  let wsManager: typeof import('../ws/websocket')['wsManager'];
  const mockToken = { access_token: 'fake-token' };

  beforeEach(async () => {
    // Habilita o controle do tempo para testar 'setTimeout'
    vi.useFakeTimers();

    // Define o retorno padrão para a obtenção do token
    mockAuthenticationClient.getTwoLeggedToken.mockResolvedValue(mockToken);

    // Importa os serviços aqui para garantir que os mocks sejam aplicados antes da execução do código do serviço
    // @ts-expect-error Vitest resolve TypeScript modules sem extensão de arquivo.
    const service = await import('../services/forge.service');
    convertRvtToIfcWS = service.convertRvtToIfcWS;
    // @ts-expect-error Vitest resolve TypeScript modules sem extensão de arquivo.
    wsManager = (await import('../ws/websocket')).wsManager;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockAxiosGet.mockReset();
    vi.useRealTimers();
  });

  it('deve converter RVT para IFC com sucesso (fluxo completo)', async () => {
    const jobId = 'job-success';
    const file = Buffer.from('fake-rvt-content');
    const filename = 'test.rvt';

    // 1. Simula o bucket já existente
    mockOssClient.getBucketDetails.mockResolvedValue({});

    // 2. Simula o upload bem-sucedido
    const objectId =
      'urn:adsk.objects:os.object:ts-ifc-api-bucket/model-123.rvt';
    mockOssClient.uploadObject.mockResolvedValue({
      objectId,
    });

    // 3. Simula o início do job
    mockModelDerivativeClient.startJob.mockResolvedValue({});

    // 4. Simula o monitoramento de progresso
    // Primeira chamada: em progresso
    mockModelDerivativeClient.getManifest.mockResolvedValueOnce({
      status: 'inprogress',
      progress: '50%',
    });
    // Demais chamadas: sucesso
    const successManifest = {
      status: 'success',
      progress: 'complete',
      derivatives: [
        {
          outputType: 'ifc',
          children: [{ urn: 'derivative-urn' }],
        },
      ],
    };
    mockModelDerivativeClient.getManifest.mockResolvedValue(successManifest);

    // 5. Simula o download do derivado
    const fakeIfcBuffer = Buffer.from('fake-ifc-content');
    mockModelDerivativeClient.getDerivativeUrl.mockResolvedValue({
      url: 'https://example.com/derivative.ifc',
    });
    mockAxiosGet.mockResolvedValue({
      data: fakeIfcBuffer,
    });

    // Executa a função principal
    const result = await convertRvtToIfcWS(file, filename, jobId);

    // Avança o tempo para disparar o monitoramento
    await vi.advanceTimersByTimeAsync(2000); // Primeiro check
    await vi.advanceTimersByTimeAsync(5000); // Segundo check (que dará sucesso)

    // Asserções
    expect(result.success).toBe(true);
    expect(result.urn).toBeDefined();

    // Verifica se o token foi obtido
    expect(mockAuthenticationClient.getTwoLeggedToken).toHaveBeenCalledOnce();

    // Verifica se os métodos dos clientes foram chamados com o token
    expect(mockOssClient.getBucketDetails).toHaveBeenCalledWith(
      'ts-ifc-api-bucket',
      { accessToken: mockToken.access_token },
    );
    expect(mockOssClient.uploadObject).toHaveBeenCalledWith(
      'ts-ifc-api-bucket',
      expect.stringContaining(filename),
      file,
      { accessToken: mockToken.access_token },
    );
    expect(mockModelDerivativeClient.startJob).toHaveBeenCalledWith(
      expect.objectContaining({ input: { urn: expect.any(String) } }),
      { accessToken: mockToken.access_token },
    );
    expect(mockModelDerivativeClient.getDerivativeUrl).toHaveBeenCalledWith(
      'derivative-urn',
      expect.any(String),
      { accessToken: mockToken.access_token },
    );

    // Verifica se o progresso foi atualizado corretamente
    expect(wsManager.updateProgress).toHaveBeenCalledWith(
      jobId,
      expect.any(Number),
      expect.any(String),
      'Uploading file to APS',
    );
    expect(wsManager.updateProgress).toHaveBeenCalledWith(
      jobId,
      expect.any(Number),
      expect.any(String),
      expect.stringContaining('Conversion in progress: 50%'),
    );
    expect(wsManager.updateProgress).toHaveBeenCalledWith(
      jobId,
      90,
      expect.any(String),
      expect.stringContaining('Conversion completed successfully'),
    );

    // Verifica se o job foi finalizado com sucesso
    expect(wsManager.completeJob).toHaveBeenCalledWith(jobId, {
      downloadUrl: expect.any(String),
      fileName: `${jobId}.ifc`,
      fileSize: 12345,
    });

    // Garante que não houve erro
    expect(wsManager.handleJobError).not.toHaveBeenCalled();
  });

  it('deve criar um bucket se ele não existir', async () => {
    const jobId = 'job-create-bucket';
    const file = Buffer.from('fake-rvt-content');
    const filename = 'test.rvt';

    // Simula erro 404, indicando que o bucket não existe
    mockOssClient.getBucketDetails.mockRejectedValue({ statusCode: 404 });

    // Simula sucesso nas etapas seguintes
    mockOssClient.createBucket.mockResolvedValue({
      bucketKey: 'ts-ifc-api-bucket',
    });
    mockOssClient.uploadObject.mockResolvedValue({
      objectId: 'some-id',
    });
    mockModelDerivativeClient.startJob.mockResolvedValue({});
    mockModelDerivativeClient.getManifest.mockResolvedValue({
      status: 'inprogress',
    });

    await convertRvtToIfcWS(file, filename, jobId);

    // Verifica se a criação do bucket foi chamada
    expect(mockOssClient.createBucket).toHaveBeenCalled();
  });

  it('deve lidar com falha na conversão', async () => {
    const jobId = 'job-fail';
    const file = Buffer.from('fake-rvt-content');
    const filename = 'test.rvt';

    // Simula sucesso no upload
    mockOssClient.getBucketDetails.mockResolvedValue({});
    mockOssClient.uploadObject.mockResolvedValue({
      objectId: 'some-id',
    });
    mockModelDerivativeClient.startJob.mockResolvedValue({});

    // Simula falha no manifesto
    mockModelDerivativeClient.getManifest.mockResolvedValue({
      status: 'failed',
      progress: 'complete',
    });

    await convertRvtToIfcWS(file, filename, jobId);

    // Avança o tempo para o monitoramento
    await vi.advanceTimersByTimeAsync(3000);

    // Verifica se o erro foi reportado
    expect(wsManager.handleJobError).toHaveBeenCalledWith(
      jobId,
      'File conversion failed.',
    );
    expect(wsManager.completeJob).not.toHaveBeenCalled();
  });
});
