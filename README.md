<div align="center">
  
  # 🎯 Attendance Hub (CRM System)
  
  <p align="center">
    <strong>A Next-Generation, Highly Secure CRM and Attendance Tracking Platform</strong>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  </p>

  <p align="center">
    <a href="#-about-the-project">About</a> •
    <a href="#-key-features">Features</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-security-architecture">Security</a> •
    <a href="#-getting-started">Getting Started</a>
  </p>
</div>

---

## 📖 About The Project

**Attendance Hub** is a fully-featured, modern CRM designed specifically for seamless attendance tracking and comprehensive data management. Built from the ground up with a focus on enterprise-grade security and a smooth user experience, it empowers organizations to easily monitor attendance, generate insightful reports, and manage data even while offline.

## ✨ Key Features

- 👥 **Advanced Attendance Tracking**: Effortlessly manage, monitor, and record daily attendance with a highly intuitive user interface.
- 🔐 **Enterprise-Grade Security**: Secure authentication, authorization, and data encryption using Supabase's powerful infrastructure.
- 📶 **Robust Offline Support**: Continue working even without internet access. Data is synced automatically via IndexedDB using Dexie.js.
- 📄 **Dynamic Document Generation**: Export critical data into PDF formats via React-PDF or Excel/CSV formats using SheetJS & Papaparse.
- 🎨 **Sleek, Modern UI/UX**: Designed with beautiful components from Shadcn UI, fully responsive Tailwind CSS layouts, and elegant animations.
- ⚡ **Lightning Fast Performance**: Leverages Next.js App Router for optimal rendering, fast load times, and improved SEO.

## 💻 Tech Stack

### Core Technologies
- **[Next.js 14](https://nextjs.org/)** - React framework for production with App Router.
- **[TypeScript](https://www.typescriptlang.org/)** - Strongly typed programming language.
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework.
- **[Supabase](https://supabase.com/)** - Open source Firebase alternative for Auth and PostgreSQL.

### State & Storage
- **[Zustand](https://zustand-demo.pmnd.rs/)** - A small, fast, and scalable bearbones state-management solution.
- **[Dexie.js](https://dexie.org/)** - A minimalist wrapper for IndexedDB for offline data persistence.

### UI & UX
- **[Shadcn UI](https://ui.shadcn.com/)** - Beautifully designed, accessible components.
- **[Lucide React](https://lucide.dev/)** - Beautiful & consistent icon toolkit.
- **React Hook Form & [Zod](https://zod.dev/)** - Robust form handling and schema-based validation.

## 🔒 Security Architecture

Security is built into the core of Attendance Hub to ensure your organization's data remains private, safe, and tamper-proof:

- **Row Level Security (RLS)**: Strict Supabase database policies ensure users can only access and manipulate data they are explicitly authorized to see.
- **Server-Side Rendering (SSR) & Server Actions**: Sensitive operations and API keys are kept safely on the server and are never exposed to the client browser.
- **Strict Data Validation**: End-to-end type safety using TypeScript combined with Zod validation completely mitigates SQL injection and XSS vulnerabilities.
- **Secure Authentication**: Leveraging `@supabase/ssr` for managing highly secure HTTP-only cookies and user sessions.

## 🚀 Getting Started

Follow these steps to set up the project locally on your machine.

### Prerequisites

Ensure you have the following installed:
- Node.js (v18.0.0 or higher)
- [pnpm](https://pnpm.io/) (Recommended package manager)
- A [Supabase](https://supabase.com/) account and project

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

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory. Copy the credentials from your Supabase dashboard:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server:**
   ```bash
   pnpm dev
   ```

5. **View the application:**
   Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<p align="center">Built with ❤️ for modern organizations.</p>
