module github.com/gitpod-io/gitpod/supervisor

go 1.16

// containerd, see https://github.com/containerd/containerd/issues/3031
replace github.com/docker/distribution v2.7.1+incompatible => github.com/docker/distribution v2.7.1-0.20190205005809-0d3efadf0154+incompatible // leeway ignore

replace github.com/docker/docker v1.13.1 => github.com/docker/engine v0.0.0-20190822205725-ed20165a37b4 // leeway ignore

require (
	github.com/Netflix/go-env v0.0.0-20200908232752-3e802f601e28
	github.com/creack/pty v1.1.11
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-daemon/api v0.0.0-00010101000000-000000000000
	github.com/golang/mock v1.5.0
	github.com/golang/protobuf v1.4.3
	github.com/google/go-cmp v0.5.4
	github.com/google/uuid v1.1.4
	github.com/grpc-ecosystem/go-grpc-middleware v1.2.2
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.2.0
	github.com/niemeyer/pretty v0.0.0-20200227124842-a10e7caefd8e // indirect
	github.com/prometheus/procfs v0.6.0
	github.com/sirupsen/logrus v1.7.0
	github.com/soheilhy/cmux v0.1.4
	github.com/spf13/cobra v1.1.1
	golang.org/x/sync v0.0.0-20201207232520-09787c993a3a
	golang.org/x/sys v0.0.0-20210331175145-43e1dd70ce54
	golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/grpc v1.36.0
	google.golang.org/grpc/examples v0.0.0-20200902210233-8630cac324bf // indirect
	gopkg.in/check.v1 v1.0.0-20200227125254-8fa46927fb4f // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace github.com/gitpod-io/gitpod/content-service => ../content-service // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../content-service-api/go // leeway

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-daemon/api => ../ws-daemon-api/go // leeway

replace k8s.io/api => k8s.io/api v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.20.4 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.20.4 // leeway indirect from components/common-go:lib
