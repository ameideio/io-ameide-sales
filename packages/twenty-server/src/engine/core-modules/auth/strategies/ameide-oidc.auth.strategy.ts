import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { type Request } from 'express';
import { Strategy, type StrategyOptions, type TokenSet } from 'openid-client';
import { type APP_LOCALES } from 'twenty-shared/translations';
import { parseJson } from 'twenty-shared/utils';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { type SocialSSOSignInUpActionType } from 'src/engine/core-modules/auth/types/signInUp.type';
import { type SocialSSOState } from 'src/engine/core-modules/auth/types/social-sso-state.type';

export type AmeideOidcRequest = Omit<
  Request,
  'user' | 'workspace' | 'workspaceMetadataVersion'
> & {
  user: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    picture: string | null;
    locale?: keyof typeof APP_LOCALES | null;
    workspaceInviteHash?: string;
    workspacePersonalInviteToken?: string;
    action: SocialSSOSignInUpActionType;
    workspaceId?: string;
    billingCheckoutSessionState?: string;
  };
};

@Injectable()
export class AmeideOidcAuthStrategy extends PassportStrategy(
  Strategy,
  'ameideOidc',
) {
  constructor(
    private client: StrategyOptions['client'],
    sessionKey: string,
  ) {
    super({
      params: {
        scope: 'openid email profile',
        code_challenge_method: 'S256',
      },
      client,
      usePKCE: true,
      passReqToCallback: true,
      sessionKey,
    });
  }

  // oxlint-disable-next-line @typescripttypescript/no-explicit-any
  authenticate(req: Request, options: any) {
    options = {
      ...options,
      state: JSON.stringify({
        workspaceInviteHash: req.query.workspaceInviteHash,
        workspacePersonalInviteToken: req.query.workspacePersonalInviteToken,
        workspaceId: req.query.workspaceId,
        billingCheckoutSessionState: req.query.billingCheckoutSessionState,
        action: req.query.action,
        locale: req.query.locale,
      }),
    };

    return super.authenticate(req, options);
  }

  private extractState(req: Request): SocialSSOState {
    const rawState =
      req.query.state && typeof req.query.state === 'string'
        ? req.query.state
        : '{}';

    return parseJson<SocialSSOState>(rawState) ?? {};
  }

  async validate(
    req: Request,
    tokenset: TokenSet,
    // oxlint-disable-next-line @typescripttypescript/no-explicit-any
    done: (err: any, user?: AmeideOidcRequest['user']) => void,
  ) {
    try {
      const state = this.extractState(req);
      const userinfo = await this.client.userinfo(tokenset);

      const email = userinfo.email ?? userinfo.upn;

      if (!email || typeof email !== 'string') {
        return done(
          new AuthException(
            'Email not found in identity provider payload',
            AuthExceptionCode.INVALID_DATA,
          ),
        );
      }

      const session = (req as unknown as { session?: Record<string, unknown> })
        .session;
      if (session && typeof tokenset.id_token === 'string') {
        session.ameideOidcIdToken = tokenset.id_token;
      }

      done(null, {
        email,
        firstName: userinfo.given_name,
        lastName: userinfo.family_name,
        picture: typeof userinfo.picture === 'string' ? userinfo.picture : null,
        workspaceInviteHash: state?.workspaceInviteHash,
        workspacePersonalInviteToken: state?.workspacePersonalInviteToken,
        workspaceId: state?.workspaceId,
        billingCheckoutSessionState: state?.billingCheckoutSessionState,
        action: state?.action ?? 'list-available-workspaces',
        locale: state?.locale,
      });
    } catch (err) {
      done(err);
    }
  }
}
