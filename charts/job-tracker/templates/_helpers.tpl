{{- define "job-tracker.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "job-tracker.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "job-tracker.labels" -}}
app.kubernetes.io/name: {{ include "job-tracker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "job-tracker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "job-tracker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "job-tracker.secretName" -}}
{{- if .Values.basicAuth.existingSecret -}}
{{- .Values.basicAuth.existingSecret -}}
{{- else -}}
{{- include "job-tracker.fullname" . -}}-auth
{{- end -}}
{{- end -}}
