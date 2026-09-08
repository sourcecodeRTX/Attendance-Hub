export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-creamy flex min-h-screen items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
