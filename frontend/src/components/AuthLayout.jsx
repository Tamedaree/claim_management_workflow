import AuthBackground from "@/components/AuthBackground";

/**
 * @typedef {Object} AuthLayoutProps
 * @property {import('lucide-react').LucideIcon} icon
 * @property {string} title
 * @property {string} [subtitle]
 * @property {import('react').ReactNode} [footer]
 * @property {import('react').ReactNode} children
 */

/**
 * @param {AuthLayoutProps} props
 */
export default function AuthLayout({
  icon: Icon,
  title,
  subtitle,
  footer = null,
  children,
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background layer — fully independent, sits behind everything */}
      <div className="absolute inset-0 z-0">
        <AuthBackground />
      </div>

      {/* Content layer — centered via grid, isolated from the background */}
      <div className="relative z-10 min-h-screen grid place-items-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-28 h-28 mb-4">
              <Icon className="w-full h-full" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold tracking-wide text-amber-400 uppercase mb-2">
              Claim Management Workflow Automation
            </p>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: "#ffffff" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2" style={{ color: "rgba(255,255,255,0.65)" }}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Card — fully opaque, so everything inside always uses your
              normal light-surface tokens regardless of the backdrop */}
          <div className="bg-white rounded-2xl shadow-2xl border border-black/5 p-8">
            {children}
          </div>

          {footer && (
            <p
              className="text-center text-sm mt-6 "
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {footer}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
