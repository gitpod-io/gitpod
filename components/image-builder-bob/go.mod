module github.com/gitpod-io/gitpod/image-builder/bob

go 1.16

require (
	github.com/Microsoft/go-winio v0.5.0 // indirect
	github.com/containerd/console v1.0.2
	github.com/containerd/containerd v1.5.3
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gofrs/flock v0.8.0 // indirect
	github.com/gogo/googleapis v1.4.1 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0 // indirect
	github.com/moby/buildkit v0.9.0
	github.com/pkg/errors v0.9.1
	github.com/spf13/cobra v1.1.3
	go.opencensus.io v0.23.0 // indirect
	golang.org/x/crypto v0.0.0-20210513164829-c07d793c2f9a
	golang.org/x/net v0.0.0-20210510120150-4163338589ed // indirect
	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/genproto v0.0.0-20210518161634-ec7691c0a37d // indirect
	google.golang.org/grpc v1.38.0
)

// copied from https://github.com/moby/buildkit/blob/master/go.mod#L73-L82
replace (
	github.com/docker/docker => github.com/docker/docker v20.10.3-0.20210609100121-ef4d47340142+incompatible
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc => github.com/tonistiigi/opentelemetry-go-contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.0.0-20210714055410-d010b05b4939
	go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace => github.com/tonistiigi/opentelemetry-go-contrib/instrumentation/net/http/httptrace/otelhttptrace v0.0.0-20210714055410-d010b05b4939
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp => github.com/tonistiigi/opentelemetry-go-contrib/instrumentation/net/http/otelhttp v0.0.0-20210714055410-d010b05b4939
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace k8s.io/api => k8s.io/api v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.21.1 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.21.1 // leeway indirect from components/common-go:lib
