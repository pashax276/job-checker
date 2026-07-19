import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DueBadge,
  StatusBadge,
  TierBadge,
} from "job-checker";

export function JobCard() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Senior Platform Engineer</CardTitle>
        <CardDescription>Anthropic · Remote (EU)</CardDescription>
        <CardAction>
          <TierBadge tier="1 - Top" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <StatusBadge status="Panel" />
        <span className="font-data text-xs text-muted-foreground">
          12d in stage
        </span>
        <DueBadge />
      </CardContent>
    </Card>
  );
}

export function SmallCard() {
  return (
    <Card size="sm" className="w-72">
      <CardHeader>
        <CardTitle>Staff Frontend Engineer</CardTitle>
        <CardDescription>Linear · Hybrid, Berlin</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <StatusBadge status="Screen" />
        <span className="font-data text-xs text-muted-foreground">3d</span>
      </CardContent>
    </Card>
  );
}

export function WithFooter() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Infrastructure Engineer</CardTitle>
        <CardDescription>Vercel · Remote (US)</CardDescription>
        <CardAction>
          <TierBadge tier="2 - High" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Take-home assessment due Friday. Recruiter mentioned the platform
          team is hiring for two seats this quarter.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button size="sm" variant="ghost">
          Skip
        </Button>
        <Button size="sm">Advance stage</Button>
      </CardFooter>
    </Card>
  );
}
