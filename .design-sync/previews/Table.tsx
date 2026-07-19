import {
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TierBadge,
} from "job-checker";

export function JobPipelineTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Status</TableHead>
          <TableHead style={{ textAlign: "right" }}>Days</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Anthropic</TableCell>
          <TableCell>Senior Platform Engineer</TableCell>
          <TableCell>
            <TierBadge tier="1 - Top" />
          </TableCell>
          <TableCell>
            <StatusBadge status="Panel" />
          </TableCell>
          <TableCell className="font-data" style={{ textAlign: "right" }}>12</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Vercel</TableCell>
          <TableCell>Infrastructure Engineer</TableCell>
          <TableCell>
            <TierBadge tier="2 - High" />
          </TableCell>
          <TableCell>
            <StatusBadge status="Screen" />
          </TableCell>
          <TableCell className="font-data" style={{ textAlign: "right" }}>5</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Linear</TableCell>
          <TableCell>Staff Frontend Engineer</TableCell>
          <TableCell>
            <TierBadge tier="2 - High" />
          </TableCell>
          <TableCell>
            <StatusBadge status="Applied" />
          </TableCell>
          <TableCell className="font-data" style={{ textAlign: "right" }}>3</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Stripe</TableCell>
          <TableCell>Backend Engineer, Payments</TableCell>
          <TableCell>
            <TierBadge tier="3 - Mid" />
          </TableCell>
          <TableCell>
            <StatusBadge status="Evaluating" />
          </TableCell>
          <TableCell className="font-data" style={{ textAlign: "right" }}>1</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function WithSelectedRow() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Status</TableHead>
          <TableHead style={{ textAlign: "right" }}>Days</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Anthropic</TableCell>
          <TableCell>
            <StatusBadge status="Panel" />
          </TableCell>
          <TableCell className="font-data" style={{ textAlign: "right" }}>12</TableCell>
        </TableRow>
        <TableRow data-state="selected">
          <TableCell className="font-medium">Vercel</TableCell>
          <TableCell>
            <StatusBadge status="Offer" />
          </TableCell>
          <TableCell className="font-data" style={{ textAlign: "right" }}>21</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Stripe</TableCell>
          <TableCell>
            <StatusBadge status="Rejected" />
          </TableCell>
          <TableCell className="font-data" style={{ textAlign: "right" }}>34</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
