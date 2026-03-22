import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { workspaceValidator } from 'src/engine/core-modules/workspace/workspace.validate';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

describe('workspaceValidator', () => {
  const workspace = {
    isGoogleAuthEnabled: false,
    isMicrosoftAuthEnabled: false,
    isPasswordAuthEnabled: false,
  } as WorkspaceEntity;

  it('treats Ameide OIDC as enabled when the provider is selected', () => {
    expect(
      workspaceValidator.isAuthEnabled(AuthProviderEnum.AmeideOidc, workspace),
    ).toBe(true);
    expect(() =>
      workspaceValidator.isAuthEnabledOrThrow(
        AuthProviderEnum.AmeideOidc,
        workspace,
      ),
    ).not.toThrow();
  });
});
