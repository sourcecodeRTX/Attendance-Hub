import { readFileSync } from 'fs';
import { resolve } from 'path';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '@/app/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('Phase 22: Final Docs/Text & Claims Integrity', () => {
  const rootDir = process.cwd();
  const pagePath = resolve(rootDir, 'src/app/page.tsx');
  const layoutPath = resolve(rootDir, 'src/app/layout.tsx');
  const loginPagePath = resolve(rootDir, 'src/app/(auth)/login/page.tsx');
  const sidebarPath = resolve(rootDir, 'src/components/layout/sidebar.tsx');
  const headerPath = resolve(rootDir, 'src/components/layout/header.tsx');
  const activityLogsPath = resolve(rootDir, 'src/app/(dashboard)/activity-logs/page.tsx');

  const pageContent = readFileSync(pagePath, 'utf-8');
  const layoutContent = readFileSync(layoutPath, 'utf-8');
  const loginContent = readFileSync(loginPagePath, 'utf-8');
  const sidebarContent = readFileSync(sidebarPath, 'utf-8');
  const headerContent = readFileSync(headerPath, 'utf-8');
  const activityLogsContent = readFileSync(activityLogsPath, 'utf-8');

  it('eliminates all dead href="#" placeholder links from the landing page', () => {
    const deadLinks = pageContent.match(/href="#"/g);
    expect(deadLinks).toBeNull();
  });

  it('eliminates fabricated marketing claims and generic SaaS placeholders from landing page', () => {
    expect(pageContent).not.toContain('AI-powered');
    expect(pageContent).not.toContain('predictions');
    expect(pageContent).not.toContain('No credit card required');
    expect(pageContent).not.toContain('Cancel anytime');
    expect(pageContent).not.toContain('Uptime SLA');
    expect(pageContent).not.toContain('Trusted by Universities Worldwide');
  });

  it('reconciles landing page with authentic offline-first & open-source descriptions', () => {
    expect(pageContent).toContain('Open-Source Academic Attendance System');
    expect(pageContent).toContain('100% Free & Open Source (MIT)');
    expect(pageContent).toContain('Self-Hostable with Supabase');
    expect(pageContent).toContain('Automated section summaries & threshold alerts');
    expect(pageContent).toContain('Dexie.js');
    expect(pageContent).toContain('RLS + TLS');
    expect(pageContent).toContain('MIT');
  });

  it('ensures application title is Attendance Hub across layout, login, and sidebar', () => {
    expect(layoutContent).toContain("title: 'Attendance Hub | University Attendance Management'");
    expect(layoutContent).not.toContain('ATT Tracker');

    expect(loginContent).toContain('<CardTitle className="text-2xl font-bold">Attendance Hub</CardTitle>');
    expect(loginContent).not.toContain('ATT Tracker');

    expect(sidebarContent).toContain("{university?.name ?? 'Attendance Hub'}");
    expect(sidebarContent).not.toContain('ATT Tracker');
  });

  it('ensures role label for admin is Department Admin across header and activity logs', () => {
    expect(headerContent).toContain("admin: 'Department Admin'");
    expect(activityLogsContent).toContain("admin: 'Department Admin'");
  });

  it('renders interactive Legal and Information modals when footer buttons are clicked', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);

    // Test Privacy Policy modal
    const privacyBtn = screen.getByRole('button', { name: 'Privacy Policy' });
    await user.click(privacyBtn);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Self-Hosted & Institution Owned/i)).toBeInTheDocument();
    const closePrivacy = screen.getAllByRole('button', { name: 'Close' })[0];
    await user.click(closePrivacy);
    expect(screen.queryByText(/Self-Hosted & Institution Owned/i)).not.toBeInTheDocument();

    // Test Terms of Service modal
    const termsBtn = screen.getByRole('button', { name: 'Terms of Service' });
    await user.click(termsBtn);
    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MIT License' })).toBeInTheDocument();
    const closeTerms = screen.getAllByRole('button', { name: 'Close' })[0];
    await user.click(closeTerms);

    // Test Cookie Policy modal
    const cookiesBtn = screen.getByRole('button', { name: 'Cookie Policy' });
    await user.click(cookiesBtn);
    expect(screen.getByRole('heading', { name: 'Cookie & Local Storage Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Strictly Necessary Session Cookies/i)).toBeInTheDocument();
    const closeCookies = screen.getAllByRole('button', { name: 'Close' })[0];
    await user.click(closeCookies);

    // Test Support modal
    const supportBtn = screen.getByRole('button', { name: 'Support' });
    await user.click(supportBtn);
    expect(screen.getByRole('heading', { name: 'Support & Documentation' })).toBeInTheDocument();
    const closeSupport = screen.getAllByRole('button', { name: 'Close' })[0];
    await user.click(closeSupport);

    // Test Status modal
    const statusBtn = screen.getByRole('button', { name: 'Status' });
    await user.click(statusBtn);
    expect(screen.getByRole('heading', { name: 'System Status & Sync Health' })).toBeInTheDocument();
    const closeStatus = screen.getAllByRole('button', { name: 'Close' })[0];
    await user.click(closeStatus);
  });
});
