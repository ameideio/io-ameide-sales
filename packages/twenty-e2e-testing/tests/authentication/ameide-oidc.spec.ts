import { expect, test } from '@playwright/test';

import { KeycloakLoginPage } from '../../lib/pom/helper/keycloakLogin';

const mustGetEnv = (key: string) => {
  const v = process.env[key];
  if (!v) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
};

test('Ameide OIDC: unauthenticated user is redirected to Keycloak and can log in and log out', async ({
  page,
}) => {
  const keycloakBaseUrl = mustGetEnv('KEYCLOAK_BASE_URL');
  const keycloakUsername = mustGetEnv('KEYCLOAK_USERNAME');
  const keycloakPassword = mustGetEnv('KEYCLOAK_PASSWORD');

  const keycloakLoginPage = new KeycloakLoginPage(page);

  await test.step('Navigate to app and expect Keycloak login', async () => {
    await page.goto('/');
    await page.waitForURL((url) => url.toString().startsWith(keycloakBaseUrl), {
      timeout: 30_000,
    });
    await expect(page).toHaveURL(new RegExp(`^${keycloakBaseUrl.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`));
  });

  await test.step('Log in on Keycloak', async () => {
    await keycloakLoginPage.login(keycloakUsername, keycloakPassword);
  });

  await test.step('Wait for redirect back to Twenty', async () => {
    // The app often redirects through /verify during auth completion.
    await page.waitForFunction(() => window.location.href.includes('verify'), {
      timeout: 60_000,
    });
    await page.waitForFunction(() => !window.location.href.includes('verify'), {
      timeout: 60_000,
    });
  });

  await test.step('Select workspace if prompted', async () => {
    const chooseWorkspace = page.getByText('Choose a workspace');
    if (await chooseWorkspace.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Seeded dev data typically provides an "Apple" workspace.
      await page.getByText('Apple', { exact: true }).click();
    }
  });

  await test.step('Confirm we are inside the app', async () => {
    // Basic smoke: the app shell should be rendered and not be on auth screen.
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Sign in');
  });

  await test.step('Log out (RP-initiated logout) and return to app', async () => {
    await page.goto('/auth/ameide-oidc/logout');
    await page.waitForURL((url) => url.toString().startsWith(keycloakBaseUrl), {
      timeout: 30_000,
    });
    await page.waitForURL((url) => !url.toString().startsWith(keycloakBaseUrl), {
      timeout: 60_000,
    });
    await expect(page).toHaveURL(/\/$/);
  });
});

