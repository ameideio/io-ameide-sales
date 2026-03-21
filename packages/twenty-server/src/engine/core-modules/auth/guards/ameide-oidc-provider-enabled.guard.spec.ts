import { type ExecutionContext } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { AmeideOidcProviderEnabledGuard } from 'src/engine/core-modules/auth/guards/ameide-oidc-provider-enabled.guard';
import { GuardRedirectService } from 'src/engine/core-modules/guard-redirect/services/guard-redirect.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

import { getAmeideOidcClient } from 'src/engine/core-modules/auth/utils/ameide-oidc-client.util';
import { AmeideOidcAuthStrategy } from 'src/engine/core-modules/auth/strategies/ameide-oidc.auth.strategy';

jest.mock('src/engine/core-modules/auth/utils/ameide-oidc-client.util', () => ({
  getAmeideOidcClient: jest.fn(),
}));

jest.mock(
  'src/engine/core-modules/auth/strategies/ameide-oidc.auth.strategy',
  () => ({
    AmeideOidcAuthStrategy: jest.fn(),
  }),
);

const createMockExecutionContext = (): ExecutionContext => {
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({}),
    }),
  } as unknown as ExecutionContext;
};

describe('AmeideOidcProviderEnabledGuard', () => {
  let guard: AmeideOidcProviderEnabledGuard;
  let twentyConfigService: { get: jest.Mock };
  let guardRedirectService: {
    dispatchErrorFromGuard: jest.Mock;
    getSubdomainAndCustomDomainFromContext: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmeideOidcProviderEnabledGuard,
        {
          provide: TwentyConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: GuardRedirectService,
          useValue: {
            dispatchErrorFromGuard: jest.fn(),
            getSubdomainAndCustomDomainFromContext: jest.fn().mockReturnValue({
              subdomain: 'test',
              customDomain: null,
            }),
          },
        },
      ],
    }).compile();

    guard = module.get<AmeideOidcProviderEnabledGuard>(
      AmeideOidcProviderEnabledGuard,
    );
    twentyConfigService = module.get(TwentyConfigService) as any;
    guardRedirectService = module.get(GuardRedirectService) as any;
  });

  it('should block and dispatch error when AUTH_AMEIDE_OIDC_ENABLED is false', async () => {
    twentyConfigService.get.mockImplementation((key: string) => {
      if (key === 'AUTH_AMEIDE_OIDC_ENABLED') return false;
      return undefined;
    });

    const context = createMockExecutionContext();

    await expect(guard.canActivate(context)).resolves.toBe(false);

    expect(getAmeideOidcClient).not.toHaveBeenCalled();
    expect(AmeideOidcAuthStrategy).not.toHaveBeenCalled();
    expect(guardRedirectService.dispatchErrorFromGuard).toHaveBeenCalledWith(
      context,
      expect.any(Error),
      { subdomain: 'test', customDomain: null },
    );
  });

  it('should allow when enabled and OIDC client can be created', async () => {
    twentyConfigService.get.mockImplementation((key: string) => {
      if (key === 'AUTH_AMEIDE_OIDC_ENABLED') return true;
      return undefined;
    });

    (getAmeideOidcClient as unknown as jest.Mock).mockResolvedValue({
      mocked: true,
    });

    const context = createMockExecutionContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(getAmeideOidcClient).toHaveBeenCalledWith(twentyConfigService);
    expect(AmeideOidcAuthStrategy).toHaveBeenCalledWith(
      { mocked: true },
      'ameideOidc',
    );
    expect(guardRedirectService.dispatchErrorFromGuard).not.toHaveBeenCalled();
  });

  it('should dispatch error when OIDC client creation fails', async () => {
    twentyConfigService.get.mockImplementation((key: string) => {
      if (key === 'AUTH_AMEIDE_OIDC_ENABLED') return true;
      return undefined;
    });

    (getAmeideOidcClient as unknown as jest.Mock).mockRejectedValue(
      new Error('boom'),
    );

    const context = createMockExecutionContext();

    await expect(guard.canActivate(context)).resolves.toBe(false);

    expect(AmeideOidcAuthStrategy).not.toHaveBeenCalled();
    expect(guardRedirectService.dispatchErrorFromGuard).toHaveBeenCalledWith(
      context,
      expect.any(Error),
      { subdomain: 'test', customDomain: null },
    );
  });
});

