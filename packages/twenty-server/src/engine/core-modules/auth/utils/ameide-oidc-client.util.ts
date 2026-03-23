import { Issuer, type Client } from 'openid-client';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

type AmeideOidcCache = {
  cacheKey: string;
  issuerPromise: Promise<Issuer>;
  clientPromise: Promise<Client>;
};

let cache: AmeideOidcCache | null = null;

const buildCacheKey = (twentyConfigService: TwentyConfigService) => {
  const issuerUrl = twentyConfigService.get('AUTH_AMEIDE_OIDC_ISSUER_URL');
  const clientId = twentyConfigService.get('AUTH_AMEIDE_OIDC_CLIENT_ID');
  const callbackUrl = twentyConfigService.get('AUTH_AMEIDE_OIDC_CALLBACK_URL');

  return `${issuerUrl}::${clientId}::${callbackUrl}`;
};

const getOrInitCache = (twentyConfigService: TwentyConfigService) => {
  const cacheKey = buildCacheKey(twentyConfigService);

  if (cache?.cacheKey === cacheKey) {
    return cache;
  }

  const issuerUrl = twentyConfigService.get('AUTH_AMEIDE_OIDC_ISSUER_URL');
  const clientId = twentyConfigService.get('AUTH_AMEIDE_OIDC_CLIENT_ID');
  const clientSecret = twentyConfigService.get(
    'AUTH_AMEIDE_OIDC_CLIENT_SECRET',
  );
  const callbackUrl = twentyConfigService.get('AUTH_AMEIDE_OIDC_CALLBACK_URL');

  const issuerPromise = Issuer.discover(issuerUrl);
  const clientPromise = issuerPromise.then(
    (issuer) =>
      new issuer.Client({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: [callbackUrl],
        response_types: ['code'],
      }),
  );

  cache = { cacheKey, issuerPromise, clientPromise };

  return cache;
};

export const getAmeideOidcIssuer = async (
  twentyConfigService: TwentyConfigService,
): Promise<Issuer> => {
  return await getOrInitCache(twentyConfigService).issuerPromise;
};

export const getAmeideOidcClient = async (
  twentyConfigService: TwentyConfigService,
): Promise<Client> => {
  return await getOrInitCache(twentyConfigService).clientPromise;
};

export const buildAmeideOidcEndSessionUrl = async (
  twentyConfigService: TwentyConfigService,
  idTokenHint?: string,
): Promise<string> => {
  const issuer = await getAmeideOidcIssuer(twentyConfigService);
  const postLogoutRedirectUrl = twentyConfigService.get(
    'AUTH_AMEIDE_OIDC_POST_LOGOUT_REDIRECT_URL',
  );

  // Keycloak supports OIDC RP-Initiated Logout. Discovery may omit
  // `end_session_endpoint` depending on configuration/version; fall back to
  // Keycloak's standard logout path.
  const endSessionEndpoint =
    issuer.metadata.end_session_endpoint ??
    `${issuer.metadata.issuer}/protocol/openid-connect/logout`;

  const endSessionUrl = new URL(endSessionEndpoint);

  endSessionUrl.searchParams.set(
    'client_id',
    twentyConfigService.get('AUTH_AMEIDE_OIDC_CLIENT_ID'),
  );
  endSessionUrl.searchParams.set(
    'post_logout_redirect_uri',
    postLogoutRedirectUrl,
  );
  if (idTokenHint) {
    endSessionUrl.searchParams.set('id_token_hint', idTokenHint);
  }

  return endSessionUrl.toString();
};
