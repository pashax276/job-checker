const BULLET_MARKER_RE = /^\s*[•\-–—*▪‣·]\s+/;
const HEADER_RE = /^[A-Z][A-Z\s/&]{3,}$/; // ALL-CAPS section headers
const EMPLOYER_RE = /^(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/;
const PERIOD_RE =
  /(19|20)\d{2}|present|current/i; // third pipe segment must look like dates

export interface ExperienceEntry {
  company: string;
  title: string;
  period: string;
}

/**
 * Marker-prefixed lines with markers stripped, in document order. PDF
 * extraction wraps long bullets across lines, so non-marker lines that
 * follow a bullet (and aren't headers/employer lines) are merged back in.
 */
export function extractBullets(text: string): string[] {
  const bullets: string[] = [];
  let open = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || HEADER_RE.test(line)) {
      open = false;
      continue;
    }
    if (EMPLOYER_RE.test(line) && PERIOD_RE.test(line.split("|").at(-1) ?? "")) {
      open = false;
      continue;
    }
    if (BULLET_MARKER_RE.test(raw)) {
      bullets.push(raw.replace(BULLET_MARKER_RE, "").trim());
      open = true;
      continue;
    }
    if (open && bullets.length > 0) {
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line}`;
    }
  }
  return bullets.filter((b) => b.length > 0);
}

/** Job history from "Company | Title | Period" lines. */
export function extractExperience(text: string): ExperienceEntry[] {
  const entries: ExperienceEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const match = EMPLOYER_RE.exec(raw.trim());
    if (!match) continue;
    const [, company, title, period] = match;
    if (!PERIOD_RE.test(period) || /@|\d{3}[-.\s]\d{3}/.test(period)) continue;
    entries.push({
      company: company.trim(),
      title: title.trim(),
      period: period.trim(),
    });
  }
  return entries;
}

/**
 * Curated DevOps/platform skill dictionary — canonical casing preserved.
 * Multi-word and symbol-bearing entries are matched with boundaries so
 * "Google" never matches "Go". Users can always add skills manually.
 */
export const SKILL_DICTIONARY = [
  "AWS", "GCP", "Azure", "Kubernetes", "EKS", "GKE", "Docker", "Terraform",
  "Pulumi", "Ansible", "Helm", "Argo CD", "Flux", "GitOps", "GitHub Actions",
  "GitLab CI", "Jenkins", "CircleCI", "CI/CD", "Prometheus", "Grafana",
  "Datadog", "OpenTelemetry", "ELK", "Splunk", "PagerDuty", "Linux", "Bash",
  "Python", "Go", "TypeScript", "Node.js", "Rust", "SQL", "PostgreSQL",
  "MySQL", "Redis", "Kafka", "RabbitMQ", "Nginx", "Envoy", "Istio",
  "Service Mesh", "Vault", "Consul", "Packer", "CloudFormation", "CDK",
  "Serverless", "Lambda", "ECS", "Fargate", "S3", "CloudFront", "Route 53",
  "IAM", "VPC", "SRE", "Site Reliability", "Incident Response", "On-call",
  "Observability", "Networking", "Security", "Cost Optimization",
] as const;

// "Go" the language collides with "go" the extremely common English verb
// ("you go look", "let's go") — case-insensitive matching flagged plain
// prose as a skill mention. Matched case-sensitively instead: real usage
// ("Go", "Golang") is capitalized; the false-positive verb is almost
// always lowercase mid-sentence. Not a complete fix (a sentence starting
// "Go build..." still collides), but it removes the common case.
const CASE_SENSITIVE_SKILLS = new Set(["Go"]);

function skillPattern(skill: string): RegExp {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const flags = CASE_SENSITIVE_SKILLS.has(skill) ? "" : "i";
  // \b fails around symbols like "CI/CD"; use explicit non-word lookarounds.
  return new RegExp(`(?<![\\w])${escaped}(?![\\w])`, flags);
}

/** Dictionary skills present in the text, canonical casing, deduped. */
export function extractSkills(text: string): string[] {
  return SKILL_DICTIONARY.filter((skill) => skillPattern(skill).test(text));
}
