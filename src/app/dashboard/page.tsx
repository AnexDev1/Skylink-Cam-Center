import { PageHeader } from "@/components/layout/page-header"
import { auth } from "@/auth"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${session?.user.name ?? "operator"} (${session?.user.role ?? "VIEWER"}). Camera connections come next.`}
      />
      <section className="rounded-xl border border-border bg-sl-surface p-6 shadow-sm">
        <h2 className="text-base">Ready for devices</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-sl-text-muted">
          Hikvision, Dahua, Uniview, and generic ONVIF cameras will be added
          from the Cameras section. No streams are connected yet.
        </p>
      </section>
    </div>
  )
}
