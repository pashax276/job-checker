import {
  AppShell,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusBadge,
  TierBadge,
} from "job-checker";

export function ShellWithContent() {
  return (
    <div style={{ height: 480 }} className="flex flex-col">
      <AppShell>
        <div className="space-y-4 p-6">
          <h1 className="font-heading text-lg font-medium">Pipeline</h1>
          <div className="flex gap-4">
            <Card size="sm" className="w-72">
              <CardHeader>
                <CardTitle>Senior Platform Engineer</CardTitle>
                <CardDescription>Anthropic · Remote (EU)</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <TierBadge tier="1 - Top" />
                <StatusBadge status="Panel" />
              </CardContent>
            </Card>
            <Card size="sm" className="w-72">
              <CardHeader>
                <CardTitle>Staff Frontend Engineer</CardTitle>
                <CardDescription>Linear · Hybrid, Berlin</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <TierBadge tier="2 - High" />
                <StatusBadge status="Screen" />
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </div>
  );
}
