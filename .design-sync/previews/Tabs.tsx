import {
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "job-checker";

export function PipelineTabs() {
  return (
    <Tabs defaultValue="active" className="w-80">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="offers">Offers</TabsTrigger>
        <TabsTrigger value="closed">Closed</TabsTrigger>
      </TabsList>
      <TabsContent value="active">
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-medium">Anthropic</span>
            <StatusBadge status="Panel" />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-medium">Vercel</span>
            <StatusBadge status="Screen" />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-medium">Linear</span>
            <StatusBadge status="Applied" />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export function LineVariant() {
  return (
    <Tabs defaultValue="overview" className="w-80">
      <TabsList variant="line">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="pt-1 text-sm text-muted-foreground">
          Senior Platform Engineer at Stripe. Panel scheduled for Thursday;
          recruiter expects a decision within a week.
        </p>
      </TabsContent>
    </Tabs>
  );
}

export function WithDisabledTab() {
  return (
    <Tabs defaultValue="applied" className="w-80">
      <TabsList>
        <TabsTrigger value="applied">Applied</TabsTrigger>
        <TabsTrigger value="screens">Screens</TabsTrigger>
        <TabsTrigger value="offers" disabled>
          Offers
        </TabsTrigger>
      </TabsList>
      <TabsContent value="applied">
        <p className="pt-1 text-sm text-muted-foreground">
          6 applications awaiting first response.
        </p>
      </TabsContent>
    </Tabs>
  );
}
