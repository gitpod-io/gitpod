module github.com/gitpod-io/gitpod/workspacekit

go 1.24

toolchain go1.24.3

godebug tlsmlkem=0

replace github.com/seccomp/libseccomp-golang => github.com/gitpod-io/libseccomp-golang v0.9.2-0.20220701021458-9bf1c833815b

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-daemon/api v0.0.0-00010101000000-000000000000
	github.com/google/go-cmp v0.6.0
	github.com/moby/sys/mountinfo v0.7.1
	github.com/rootless-containers/rootlesskit v1.0.0
	github.com/seccomp/libseccomp-golang v0.9.1
	github.com/spf13/cobra v1.8.1
	golang.org/x/sys v0.21.0
	golang.org/x/xerrors v0.0.0-20220907171357-04be3eba64a2
	google.golang.org/grpc v1.65.0
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/fatih/camelcase v1.0.0 // indirect
	github.com/fatih/gomodifytags v1.14.0 // indirect
	github.com/fatih/structtag v1.2.0 // indirect
	github.com/gitpod-io/gitpod/components/scrubber v0.0.0-00010101000000-000000000000 // indirect
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0 // indirect
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0 // indirect
	github.com/hashicorp/golang-lru v1.0.2 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.2 // indirect
	github.com/opentracing/opentracing-go v1.2.0 // indirect
	github.com/prometheus/client_golang v1.19.1 // indirect
	github.com/prometheus/client_model v0.6.1 // indirect
	github.com/prometheus/common v0.55.0 // indirect
	github.com/prometheus/procfs v0.15.1 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	golang.org/x/net v0.26.0 // indirect
	golang.org/x/text v0.16.0 // indirect
	golang.org/x/time v0.3.0 // indirect
	golang.org/x/tools v0.21.1-0.20240508182429-e35e4ccd0d2d // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240701130421-f6361c86f094 // indirect
	google.golang.org/protobuf v1.34.2 // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace github.com/gitpod-io/gitpod/components/scrubber => ../scrubber // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../content-service-api/go // leeway

replace github.com/gitpod-io/gitpod/ws-daemon/api => ../ws-daemon-api/go // leeway

replace k8s.io/api => k8s.io/api v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.30.9 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/dynamic-resource-allocation => k8s.io/dynamic-resource-allocation v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/endpointslice => k8s.io/endpointslice v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/kms => k8s.io/kms v0.31.9 // leeway indirect from components/common-go:lib

replace k8s.io/cri-client => k8s.io/cri-client v0.31.9 // leeway indirect from components/common-go:lib
