import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display hero section with headline', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SuperHRD' })).toBeVisible();
    await expect(page.getByText(/screen 100 cvs in minutes/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
  });

  test('should display stats section with 3 cards', async ({ page }) => {
    await expect(page.getByText('10x')).toBeVisible();
    await expect(page.getByText('95%')).toBeVisible();
    await expect(page.getByText('24/7')).toBeVisible();
  });

  test('should display features section', async ({ page }) => {
    await expect(page.getByText('Upload CVs')).toBeVisible();
    await expect(page.getByText('AI Screening')).toBeVisible();
    await expect(page.getByText('Hiring Insights')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.getByRole('link', { name: /sign in/i }).first().click();
    await expect(page).toHaveURL('/login');
    
    await page.goto('/');
    
    await page.getByRole('link', { name: /get started/i }).first().click();
    await expect(page).toHaveURL('/register');
  });

  test('should have responsive design', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
