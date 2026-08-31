<div align="center">
  
  # 🎯 Attendance Hub
  
  <p align="center">
    <strong>A Next-Generation, Highly Secure Academic Attendance Tracking and Student Information Platform</strong>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License: MIT" />
  </p>

  <p align="center">
    <a href="#-about-the-project">About</a> •
    <a href="#-key-features">Features</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-role-hierarchy--access-control">Roles</a> •
    <a href="#-security--data-integrity-architecture">Security</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-testing--verification-gates">Testing</a>
  </p>
</div>

---

## 📖 About The Project

**Attendance Hub** is a modern, offline-first attendance management and student tracking platform designed specifically for academic institutions, universities, and departments. Built with Next.js 14 App Router, Supabase PostgreSQL, and Dexie.js (IndexedDB), Attendance Hub provides instantaneous local response times, reliable multi-tab background synchronization, strict role-based access control, and complete data ownership.

Whether connected online or operating in network-constrained environments, teachers and student representatives can mark attendance, calculate real-time section statistics, export audit-ready PDF/CSV reports, and securely synchronize records to the cloud.

---

## ✨ Key Features

- 👥 **Intuitive Attendance Tracking**: Mark daily and period-based attendance with responsive keyboard navigation, instant status toggles (Present, Absent, Duty Leave), unsaved-changes protection, and automatic duplicate period prevention.
- 📶 **Robust Offline-First Architecture**: Continuous local operability backed by IndexedDB via Dexie.js. Local writes are transactional, and queued records synchronize to Supabase in the background with exponential backoff and lease management.
- 🔄 **Monotonic Revision Conflict Resolution**: Multi-device sync uses server-managed monotonic revision counters to resolve concurrent updates deterministically without relying on unsynchronized client clocks.
- 🛡️ **PostgreSQL Row Level Security (RLS)**: Fine-grained access policies across 23 append-only database migrations guarantee strict multi-tenant and department-level data isolation.
- 📄 **Dynamic Report Generation & Safe Import**:
  - Export audit-ready attendance summaries to PDF via `@react-pdf/renderer`.
  - Export CSV logs with OWASP formula-injection neutralization via Papaparse.
  - Import student rosters via a hardened 5MB CSV parser with header alias resolution and in-file duplicate detection.
  - Package full university database backups as encrypted JSON archives using JSZip.
- 🎨 **Accessible & Responsive UI/UX**: Built with accessible component primitives from Base UI, fully keyboard-traversable tables and dialogs, live-region state announcements, `prefers-reduced-motion` compliance, and Tailwind CSS.
- ⚡ **High Performance & Virtualization**: Next.js 14 App Router with React 18, TanStack Virtual for rendering large student lists smoothly, and debounced local cache re-reads.

---

## 💻 Tech Stack

### Core Technologies
- **[Next.js 14](https://nextjs.org/)** - React framework with App Router, server actions, and route handlers.
- **[React 18](https://react.dev/)** - Component architecture with concurrent rendering and hooks.
- **[TypeScript 5](https://www.typescriptlang.org/)** - Strict type safety across client and server boundaries.
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first styling with responsive design and motion tokens.
- **[Supabase](https://supabase.com/)** - Open-source PostgreSQL backend with Row Level Security and Auth (`@supabase/ssr`, `@supabase/supabase-js`).

### State Management & Offline Persistence
- **[Zustand 5](https://zustand-demo.pmnd.rs/)** - Fast, lightweight state stores for auth, UI state, and sync status.
- **[Dexie.js 4](https://dexie.org/)** - IndexedDB wrapper providing transactional multi-table local persistence.

### UI Primitives & Accessibility
- **[Base UI](https://base-ui.com/)** - Unstyled, accessible UI component primitives (dialogs, dropdowns, popovers).
- **[Lucide React](https://lucide.dev/)** - Accessible iconography.
- **[TanStack Virtual](https://tanstack.com/virtual)** - DOM virtualization for high-volume student rosters.
- **[Sonner](https://sonner.emilkowal.ski/)** - Accessible toast notifications with action callbacks and live region updates.
- **React Hook Form & [Zod 4](https://zod.dev/)** - Schema validation enforced on client forms and server actions.

### Document Processing & Serialization
- **[@react-pdf/renderer](https://react-pdf.org/)** - Client-side PDF generation for attendance and section reports.
- **[Papaparse](https://www.papaparse.com/)** - Fast, streaming CSV parser and serializer.
- **[JSZip](https://stuk.github.io/jszip/)** - Archive packaging for full-university JSON data backup and restore.

### Testing & Tooling
- **[Vitest 4](https://vitest.dev/)** - Unit and integration test runner with jsdom environment and V8 coverage.
- **[@testing-library/react](https://testing-library.com/)** - Component and user-event testing.
- **[fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB)** - In-memory IndexedDB mock for hermetic Dexie tests.
- **[GitHub Actions](https://github.com/features/actions)** - Automated CI pipeline with frozen-lockfile quality gates.

---

## 👥 Role Hierarchy & Access Control

Attendance Hub enforces a 5-tier role hierarchy validated server-side and constrained by PostgreSQL Row Level Security:

| Role | Database Identifier | Permissions & Capabilities |
|---|---|---|
| **Super Admin** | `super_admin` | Full institution management: create and oversee departments, manage institution settings, trigger whole-university backups/restores, wipe university data, inspect global activity logs. |
| **Department Admin** | `admin` | Department administration: manage specialisations, sections, teachers, course representatives (CRs), and department-scoped activity logs and student records. |
| **Primary Teacher** | `primary_teacher` | Section leadership: manage assigned section students, upload student rosters via CSV, create/reset Course Representatives, record and edit attendance sessions. |
| **Regular Teacher** | `regular_teacher` | Subject instruction: mark attendance for assigned subjects across designated sections. |
| **Course Representative** | `cr` | Student delegate: record daily attendance marks for their assigned section (subject to teacher locking and conflict resolution rules). |

---

## 🔒 Security & Data Integrity Architecture

Security and integrity are built into every layer of Attendance Hub:

1. **Row Level Security (RLS)**: Supabase PostgreSQL database policies constrain every query. Client JWTs cannot read or write records outside their institution or authorized department scope.
2. **Server-Side Session Revalidation**: Privileged server actions verify caller identity via `@supabase/ssr` (`auth.getUser()`) rather than trusting client-supplied arguments or unverified cookies.
3. **Fail-Fast Secrets Isolation**: Server-only keys (`SUPABASE_SERVICE_ROLE_KEY`) are kept on the server, never given a `NEXT_PUBLIC_` prefix, and validated at startup.
4. **Strict Schema Sanitization**: Shared Zod schemas trim whitespace, enforce length bounds, validate UUID formats, and are re-evaluated inside server actions prior to database writes.
5. **OWASP Formula Injection Defense**: All exported CSV fields are sanitized by prefixing dangerous characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with single quotes.
6. **Immutable Audit Trail Attribution**: Activity logs use database triggers to bind `performed_by_*` fields to `auth.uid()` directly from the PostgreSQL session profile, preventing log attribution tampering.

---

## 🚀 Getting Started

Follow these steps to set up Attendance Hub locally.

### Prerequisites

- **Node.js**: `v18.17.0` or higher (required by Next.js 14)
- **Package Manager**: [pnpm](https://pnpm.io/) (`v10.0.0` or higher recommended)
- **Backend**: A [Supabase](https://supabase.com/) account and project (PostgreSQL + Auth)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/attendance-hub.git
   cd attendance-hub
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   Create a `.env.local` file in the project root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project REST/Auth URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase public anonymous API key (used in browser client).
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role secret key (**server-only**, **never** exposed to client). Required for registration, user management, and super admin operations.
   - `NEXT_PUBLIC_APP_URL`: The public URL of the application. Used for password-reset email redirects. (Falls back to `window.location.origin` in browser if omitted; ensure the redirect URL is allowlisted in Supabase Auth settings).

4. **Apply Database Migrations:**
   Execute the migration scripts located in `supabase/migrations/` sequentially against your Supabase PostgreSQL database (from `001_initial_schema.sql` through `023_attendance_period_unique.sql`):
   ```bash
   # If using the Supabase CLI:
   supabase db push
   ```

5. **Start the development server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification Gates

The codebase includes an extensive automated test suite executed with [Vitest](https://vitest.dev/):

```bash
# Run all unit and integration tests
pnpm test

# Run tests in interactive watch mode
pnpm run test:watch

# Run tests with V8 code coverage report
pnpm run test:coverage

# Run ESLint validation
pnpm run lint

# Run TypeScript typecheck
pnpm run typecheck

# Run Next.js production build verification
pnpm run build
```

### Continuous Integration (CI)

Every pull request and push to `main` is validated automatically via GitHub Actions (`.github/workflows/ci.yml`), executing the frozen-lockfile quality gates:
1. `pnpm install --frozen-lockfile`
2. `pnpm audit --audit-level=critical`
3. `pnpm run lint`
4. `pnpm run typecheck`
5. `pnpm run test`
6. `pnpm run build`

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Ensure all verification gates pass (`pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build`)
4. Commit your changes (`git commit -m 'feat: add AmazingFeature'`)
5. Push to the branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---
<p align="center">Built with ❤️ for modern academic institutions.</p>
