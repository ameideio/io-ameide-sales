import { Issuer } from 'openid-client';

import { buildAmeideOidcEndSessionUrl } from 'src/engine/core-modules/auth/utils/ameide-oidc-client.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

jest.mock('openid-client', () => ({
  Issuer: {
    discover: jest.fn(),
  },
}));

const createConfigService = (values: Record<string, string>) => {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as TwentyConfigService;
};

describe('buildAmeideOidcEndSessionUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses issuer metadata end_session_endpoint when present', async () => {
    (Issuer.discover as unknown as jest.Mock).mockResolvedValue({
      Client: jest.fn().mockImplementation(() => ({})),
      metadata: {
        issuer: 'https://idp.example.test/realms/ameide',
        end_session_endpoint:
          'https://idp.example.test/realms/ameide/protocol/openid-connect/logout',
      },
    });

    const configService = createConfigService({
      AUTH_AMEIDE_OIDC_ISSUER_URL: 'https://idp.example.test/realms/ameide',
      AUTH_AMEIDE_OIDC_CLIENT_ID: 'twenty',
      AUTH_AMEIDE_OIDC_CALLBACK_URL:
        'https://sales.ameide.io/auth/ameide-oidc/redirect',
      AUTH_AMEIDE_OIDC_POST_LOGOUT_REDIRECT_URL: 'https://sales.ameide.io/',
    });

    const url = await buildAmeideOidcEndSessionUrl(configService);

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      'https://idp.example.test/realms/ameide/protocol/openid-connect/logout',
    );
    expect(parsed.searchParams.get('client_id')).toBe('twenty');
    expect(parsed.searchParams.get('post_logout_redirect_uri')).toBe(
      'https://sales.ameide.io/',
    );
  });

  it('falls back to Keycloak standard logout path when end_session_endpoint is missing', async () => {
    (Issuer.discover as unknown as jest.Mock).mockResolvedValue({
      Client: jest.fn().mockImplementation(() => ({})),
      metadata: {
        issuer: 'https://idp2.example.test/realms/ameide',
      },
    });

    const configService = createConfigService({
      AUTH_AMEIDE_OIDC_ISSUER_URL: 'https://idp2.example.test/realms/ameide',
      AUTH_AMEIDE_OIDC_CLIENT_ID: 'twenty',
      AUTH_AMEIDE_OIDC_CALLBACK_URL:
        'https://sales.ameide.io/auth/ameide-oidc/redirect',
      AUTH_AMEIDE_OIDC_POST_LOGOUT_REDIRECT_URL:
        'https://sales.ameide.io/logged-out',
    });

    const url = await buildAmeideOidcEndSessionUrl(configService);

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      'https://idp2.example.test/realms/ameide/protocol/openid-connect/logout',
    );
    expect(parsed.searchParams.get('client_id')).toBe('twenty');
    expect(parsed.searchParams.get('post_logout_redirect_uri')).toBe(
      'https://sales.ameide.io/logged-out',
    );
  });

  it('includes id_token_hint when provided', async () => {
    (Issuer.discover as unknown as jest.Mock).mockResolvedValue({
      Client: jest.fn().mockImplementation(() => ({})),
      metadata: {
        issuer: 'https://idp.example.test/realms/ameide',
        end_session_endpoint:
          'https://idp.example.test/realms/ameide/protocol/openid-connect/logout',
      },
    });

    const configService = createConfigService({
      AUTH_AMEIDE_OIDC_ISSUER_URL: 'https://idp.example.test/realms/ameide',
      AUTH_AMEIDE_OIDC_CLIENT_ID: 'twenty',
      AUTH_AMEIDE_OIDC_CALLBACK_URL:
        'https://sales.ameide.io/auth/ameide-oidc/redirect',
      AUTH_AMEIDE_OIDC_POST_LOGOUT_REDIRECT_URL: 'https://sales.ameide.io/',
    });

    const url = await buildAmeideOidcEndSessionUrl(
      configService,
      'header.payload.signature',
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get('id_token_hint')).toBe(
      'header.payload.signature',
    );
  });
});
