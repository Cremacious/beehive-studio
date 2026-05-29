type Props = { title: string; phase: string }

export function ComingSoon({ title, phase }: Props) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <h2 className="text-lg font-medium mb-2 text-foreground">{title}</h2>
      <p>{phase}</p>
    </div>
  )
}
