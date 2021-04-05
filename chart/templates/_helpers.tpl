{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "gitpod.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "gitpod.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
installation names
*/}}
{{- define "gitpod.installation.longname" -}}{{- $gp := .gp -}}{{ $gp.installation.stage }}.{{ $gp.installation.tenant }}.{{ $gp.installation.region }}.{{ $gp.installation.cluster }}{{- end -}}
{{- define "gitpod.installation.shortname" -}}{{- $gp := .gp -}}{{- if $gp.installation.shortname -}}{{ $gp.installation.shortname }}{{- else -}}{{ $gp.installation.region }}-{{ $gp.installation.cluster }}{{- end -}}{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "gitpod.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "gitpod.container.imagePullPolicy" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $comp := .comp -}}
imagePullPolicy: {{ $comp.imagePullPolicy | default $gp.imagePullPolicy | default "IfNotPresent" }}
{{- end -}}

{{- define "gitpod.container.resources" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $comp := .comp -}}
resources:
  requests:
    cpu: {{ if $comp.resources }} {{ $comp.resources.cpu | default $gp.resources.default.cpu }}{{ else }}{{ $gp.resources.default.cpu }}{{ end }}
    memory: {{ if $comp.resources }} {{ $comp.resources.memory | default $gp.resources.default.memory }}{{ else }}{{ $gp.resources.default.memory }}{{ end -}}
{{- end -}}

{{- define "gitpod.container.ports" -}}
{{- $ := .root -}}
{{- $comp := .comp -}}
{{- if $comp.ports }}
ports:
{{- range $key, $val := $comp.ports }}
{{- if $val.containerPort }}
- name: {{ $key | lower }}
  containerPort: {{ $val.containerPort }}
{{- end -}}
{{- end }}
{{- end }}
{{- end -}}

{{- define "gitpod.pod.dependsOn" -}}
{{- $ := .root -}}
{{- $comp := .comp -}}
{{- if $comp.dependsOn }}
{{- range $path := $comp.dependsOn }}
checksum/{{ $path }}: {{ include (print $.Template.BasePath "/" $path) $ | sha256sum }}
{{- end }}
{{- end }}
{{- end -}}

{{- define "gitpod.pod.affinity" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $comp := .comp -}}
{{- if $comp.affinity -}}
affinity:
{{ $comp.affinity | toYaml | indent 2 }}
{{- else if $gp.affinity -}}
affinity:
{{ $gp.affinity | toYaml | indent 2 }}
{{- end -}}
{{- end -}}

{{- define "gitpod.workspaceAffinity" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $expr := dict -}}
{{- if $gp.components.workspace.affinity -}}
{{- if $gp.components.workspace.affinity.default -}}{{- $_ := set $expr $gp.components.workspace.affinity.default "" -}}{{- end -}}
{{- if $gp.components.workspace.affinity.prebuild -}}{{- $_ := set $expr $gp.components.workspace.affinity.prebuild "" -}}{{- end -}}
{{- if $gp.components.workspace.affinity.probe -}}{{- $_ := set $expr $gp.components.workspace.affinity.probe "" -}}{{- end -}}
{{- if $gp.components.workspace.affinity.regular -}}{{- $_ := set $expr $gp.components.workspace.affinity.regular "" -}}{{- end -}}
{{- end -}}
{{- /* 
  In a previous iteration of the templates the node affinity was part of the workspace pod template. 
  In that case we need to extract the affinity from the template and add it to the workspace affinity set.
*/ -}}
{{- if $gp.components.workspace.template -}}
{{- if $gp.components.workspace.template.spec -}}
{{- if $gp.components.workspace.template.spec.affinity -}}
{{- if $gp.components.workspace.template.spec.affinity.nodeAffinity -}}
{{- if $gp.components.workspace.template.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution -}}
{{- range $_, $t := $gp.components.workspace.template.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms -}}
{{- range $_, $m := $t.matchExpressions -}}
    {{- $_ := set $expr $m.key "" -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- if not (eq (len $expr) 0) -}}
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
      {{- range $key, $val := $expr }}
      - matchExpressions:
        - key: {{ $key }}
          operator: Exists
      {{- end }}
{{- end -}}
{{- end -}}

{{- define "gitpod.msgbusWaiter.container" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $this := dict "root" $ "gp" $gp "comp" $gp.serviceWaiter -}}
- name: msgbus-waiter
  image: {{ template "gitpod.comp.imageFull" $this }}
  args:
  - -v
  - messagebus
  securityContext:
    privileged: false
    runAsUser: 31001
  env:
{{ include "gitpod.container.messagebusEnv" . | indent 2 }}
{{- end -}}

{{- define "gitpod.databaseWaiter.container" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $this := dict "root" $ "gp" $gp "comp" $gp.serviceWaiter -}}
- name: database-waiter
  image: {{ template "gitpod.comp.imageFull" $this }}
  args:
  - -v
  - database
  securityContext:
    privileged: false
    runAsUser: 31001
  env:
{{ include "gitpod.container.dbEnv" . | indent 2 }}
{{- end -}}

{{- define "gitpod.scheme" -}}
{{- $gp := .gp -}}
{{- if or $gp.certificatesSecret.secretName $gp.forceHTTPS -}}
https
{{- else -}}
http
{{- end -}}
{{- end -}}

{{- define "gitpod.container.defaultEnv" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
env:
- name: KUBE_STAGE
  value: "{{ $gp.installation.stage }}"
- name: KUBE_NAMESPACE
  valueFrom:
    fieldRef:
      fieldPath: metadata.namespace
{{- if not .noVersion }}
- name: VERSION
  value: "{{ $gp.version }}"
{{- end }}
- name: HOST_URL
  value: "{{- template "gitpod.scheme" . -}}://{{ $gp.hostname }}"
- name: GITPOD_REGION
  value: "{{ $gp.installation.region }}"
- name: GITPOD_INSTALLATION_LONGNAME
  value: {{ template "gitpod.installation.longname" . }}
- name: GITPOD_INSTALLATION_SHORTNAME
  value: {{ template "gitpod.installation.shortname" . }}
{{- end -}}

{{- define "gitpod.container.dbEnv" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
- name: DB_HOST
  value: "{{ $gp.db.host }}"
- name: DB_PORT
  value: "{{ $gp.db.port }}"
- name: DB_PASSWORD
  value: "{{ $gp.db.password }}"
{{- if $gp.db.disableDeletedEntryGC }}
- name: DB_DELETED_ENTRIES_GC_ENABLED
  value: "false"
{{- end }}
- name: DB_ENCRYPTION_KEYS
{{- if $gp.dbEncryptionKeys.secretName }}
  valueFrom:
    secretKeyRef:
      name: {{ $gp.dbEncryptionKeys.secretName }}
      key: keys
{{- else }}
  value: {{ $.Files.Get $gp.dbEncryptionKeys.file | quote }}
{{- end -}}
{{- end -}}

{{- define "gitpod.container.messagebusEnv" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
- name: MESSAGEBUS_USERNAME
  value: "{{ $gp.messagebus.username }}"
- name: MESSAGEBUS_PASSWORD
  value: "{{ $gp.messagebus.password }}"
- name: MESSAGEBUS_CA
  valueFrom:
    secretKeyRef:
        name: {{ $gp.messagebus.secretName }}
        key: ca
- name: MESSAGEBUS_CERT
  valueFrom:
    secretKeyRef:
        name: {{ $gp.messagebus.secretName }}
        key: cert
- name: MESSAGEBUS_KEY
  valueFrom:
    secretKeyRef:
        name: {{ $gp.messagebus.secretName }}
        key: key
{{- end -}}

{{- define "gitpod.container.tracingEnv" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $comp := .comp -}}
{{- $tracing := $comp.tracing | default $gp.tracing -}}
{{- if $tracing }}
{{- if $tracing.endoint }}          
- name: JAEGER_ENDPOINT
  value: {{ $tracing.endoint }}
{{- else }}
- name: JAEGER_AGENT_HOST
  valueFrom:
    fieldRef:
      fieldPath: status.hostIP
{{- end }}
- name: JAEGER_SAMPLER_TYPE
  value: {{ $tracing.samplerType }}
- name: JAEGER_SAMPLER_PARAM
  value: "{{ $tracing.samplerParam }}"
{{- end }}
{{- end -}}

{{- define "gitpod.builtinRegistry.name" -}}
{{- if .Values.components.imageBuilder.registry.bypassProxy -}}
{{ index .Values "docker-registry" "fullnameOverride" }}.{{ .Release.Namespace }}.svc.cluster.local
{{- else -}}
registry.{{ .Values.hostname }}
{{- end -}}
{{- end -}}

{{- define "gitpod.comp.version" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $comp := .comp -}}
{{- required "please specify the Gitpod version to use in your values.yaml or with the helm flag --set version=x.x.x" ($comp.version | default $gp.version) -}}
{{- end -}}

{{- define "gitpod.comp.imageRepo" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $comp := .comp -}}
{{- $comp.imagePrefix | default $gp.imagePrefix -}}{{- $comp.imageName | default $comp.name -}}
{{- end -}}

{{- define "gitpod.comp.imageFull" -}}
{{- $ := .root -}}
{{- $gp := .gp -}}
{{- $comp := .comp -}}
{{ template "gitpod.comp.imageRepo" . }}:{{- template "gitpod.comp.version" . -}}
{{- end -}}

{{- define "gitpod.comp.configMap" -}}
{{- $comp := .comp -}}
{{ $comp.configMapName | default (printf "%s-config" $comp.name) }}
{{- end -}}

{{- define "gitpod.pull-secret" -}}
{{- $ := .root -}}
{{- if (and .secret .secret.secretName .secret.path (not (eq ($.Files.Get .secret.path) ""))) -}}
{{- $name := .secret.secretName -}}
{{- $path := .secret.path -}}
apiVersion: v1
kind: Secret
metadata:
  name: {{ $name }}
  labels:
    app: {{ template "gitpod.fullname" $ }}
    chart: "{{ $.Chart.Name }}-{{ $.Chart.Version }}"
    release: "{{ $.Release.Name }}"
    heritage: "{{ $.Release.Service }}"
  annotations:
    checksum/checksd-config: {{ $.Files.Get $path | b64enc | indent 2 | sha256sum }}
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: "{{ $.Files.Get $path | b64enc }}"
{{- end -}}
{{- end -}}

{{- define "gitpod.remoteStorage.config" -}}
{{- $ := .root -}}
{{- $remoteStorageMinio := .remoteStorage.minio | default dict -}}
{{- $minio := $.Values.minio | default dict -}}
storage:
{{- if eq .remoteStorage.kind "minio" }}
  kind: minio
  blobQuota: {{ .remoteStorage.blobQuota | default 0 }}
  minio:
    endpoint: {{ $remoteStorageMinio.endpoint | default (printf "minio.%s" $.Values.hostname) }}
    accessKey: {{ required "minio access key is required, please add a value to your values.yaml or with the helm flag --set minio.accessKey=xxxxx" ($remoteStorageMinio.accessKey | default $minio.accessKey) }}
    secretKey: {{ required "minio secret key is required, please add a value to your values.yaml or with the helm flag --set minio.secretKey=xxxxx" ($remoteStorageMinio.secretKey | default $minio.secretKey) }}
    secure: {{ $remoteStorageMinio.secure | default ($minio.enabled | default false) }}
    region: {{ $remoteStorageMinio.region | default "local" }}
    parallelUpload: {{ $remoteStorageMinio.parallelUpload | default "" }}
    maxBackupSize: {{ $remoteStorageMinio.maxBackupSize | default "" }}
    tmpdir: {{ $remoteStorageMinio.tmpdir | default "/tmp" }}
{{- else }}
{{ toYaml .remoteStorage | indent 2 }}
{{- end -}}
{{- end -}}
