const BULLET_MARKER_RE = /^\s*[•\-–—*▪‣·]\s+/;

/** Marker-prefixed lines with the marker stripped, in document order. */
export function extractBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line) => BULLET_MARKER_RE.test(line))
    .map((line) => line.replace(BULLET_MARKER_RE, "").trim())
    .filter((line) => line.length > 0);
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

function skillPattern(skill: string): RegExp {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  // \b fails around symbols like "CI/CD"; use explicit non-word lookarounds.
  return new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i");
}

/** Dictionary skills present in the text, canonical casing, deduped. */
export function extractSkills(text: string): string[] {
  return SKILL_DICTIONARY.filter((skill) => skillPattern(skill).test(text));
}
