import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Skylink CamCenter is the control surface for connecting, streaming, and managing IP cameras. This phase is the application shell — camera connections come next."
      />
      <section className="rounded-xl border border-border bg-sl-surface p-6 shadow-sm">
        <h2 className="text-base">Ready for devices</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-sl-text-muted">
          Hikvision, Dahua, Uniview, and generic ONVIF cameras will be added
          from the Cameras section. No streams or device credentials are wired
          up yet.
        </p>
        <Button className="mt-5">Primary action</Button>
      </section>
    </div>
  )
}
