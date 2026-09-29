export function PageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-sl-text-muted">{description}</p>
    </div>
  )
}
