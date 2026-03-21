import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { AmeideOidcAuthStrategy } from 'src/engine/core-modules/auth/strategies/ameide-oidc.auth.strategy';
import { getAmeideOidcClient } from 'src/engine/core-modules/auth/utils/ameide-oidc-client.util';
import { GuardRedirectService } from 'src/engine/core-modules/guard-redirect/services/guard-redirect.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

@Injectable()
export class AmeideOidcProviderEnabledGuard implements CanActivate {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly guardRedirectService: GuardRedirectService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      if (!this.twentyConfigService.get('AUTH_AMEIDE_OIDC_ENABLED')) {
        throw new AuthException(
          'Ameide OIDC auth is not enabled',
          AuthExceptionCode.OAUTH_ACCESS_DENIED,
        );
      }

      const client = await getAmeideOidcClient(this.twentyConfigService);

      new AmeideOidcAuthStrategy(client, 'ameideOidc');

      return true;
    } catch (err) {
      this.guardRedirectService.dispatchErrorFromGuard(
        context,
        err,
        this.guardRedirectService.getSubdomainAndCustomDomainFromContext(
          context,
        ),
      );

      return false;
    }
  }
}

