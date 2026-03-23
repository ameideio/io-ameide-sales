import {
  Controller,
  Get,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { type Request, Response } from 'express';

import { AuthOAuthExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-oauth-exception.filter';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { AmeideOidcOauthGuard } from 'src/engine/core-modules/auth/guards/ameide-oidc-oauth.guard';
import { AmeideOidcProviderEnabledGuard } from 'src/engine/core-modules/auth/guards/ameide-oidc-provider-enabled.guard';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { AmeideOidcRequest } from 'src/engine/core-modules/auth/strategies/ameide-oidc.auth.strategy';
import { buildAmeideOidcEndSessionUrl } from 'src/engine/core-modules/auth/utils/ameide-oidc-client.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

@Controller('auth/ameide-oidc')
@UseFilters(AuthRestApiExceptionFilter)
export class AmeideOidcAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  @Get()
  @UseGuards(
    AmeideOidcProviderEnabledGuard,
    AmeideOidcOauthGuard,
    PublicEndpointGuard,
    NoPermissionGuard,
  )
  async ameideOidcAuth() {
    // As this method is protected by OIDC guard, it will trigger the OIDC flow.
    return;
  }

  @Get('redirect')
  @UseGuards(
    AmeideOidcProviderEnabledGuard,
    AmeideOidcOauthGuard,
    PublicEndpointGuard,
    NoPermissionGuard,
  )
  @UseFilters(AuthOAuthExceptionFilter)
  async ameideOidcAuthRedirect(
    @Req() req: AmeideOidcRequest,
    @Res() res: Response,
  ) {
    return res.redirect(
      await this.authService.signInUpWithSocialSSO(
        req.user,
        AuthProviderEnum.AmeideOidc,
      ),
    );
  }

  @Get('logout')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async ameideOidcLogout(@Req() req: Request, @Res() res: Response) {
    if (!this.twentyConfigService.get('AUTH_AMEIDE_OIDC_ENABLED')) {
      return res.redirect('/');
    }

    const session = (req as unknown as { session?: Record<string, unknown> })
      .session;
    const idTokenHint =
      session && typeof session.ameideOidcIdToken === 'string'
        ? session.ameideOidcIdToken
        : undefined;

    if (session) {
      delete session.ameideOidcIdToken;
    }

    const url = await buildAmeideOidcEndSessionUrl(
      this.twentyConfigService,
      idTokenHint,
    );

    const sessionWithDestroy = (req as unknown as {
      session?: { destroy?: (cb: (err?: unknown) => void) => void };
    }).session;
    if (typeof sessionWithDestroy?.destroy === 'function') {
      return await new Promise<void>((resolve) => {
        sessionWithDestroy.destroy(() => {
          res.redirect(url);
          resolve();
        });
      });
    }

    return res.redirect(url);
  }
}
