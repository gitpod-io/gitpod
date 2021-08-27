module github.com/gitpod-io/gitpod/blobserve

go 1.17

require (
	github.com/containerd/containerd v1.5.5
	github.com/docker/cli v20.10.7+incompatible
	github.com/docker/distribution v2.7.1+incompatible
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/registry-facade v0.0.0-00010101000000-000000000000
	github.com/google/go-cmp v0.5.6
	github.com/gorilla/mux v1.8.0
	github.com/opencontainers/image-spec v1.0.1
	github.com/prometheus/client_golang v1.11.0
	github.com/spf13/cobra v1.1.3
	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.1.1 // indirect
	github.com/docker/docker-credential-helpers v0.6.4 // indirect
	github.com/felixge/httpsnoop v1.0.1 // indirect
	github.com/gitpod-io/gitpod/registry-facade/api v0.0.0-00010101000000-000000000000 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/gorilla/handlers v1.5.1 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0 // indirect
	github.com/hashicorp/golang-lru v0.5.4 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/klauspost/compress v1.11.13 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.2-0.20181231171920-c182affec369 // indirect
	github.com/moby/locker v1.0.1 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opentracing/opentracing-go v1.2.0 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/prometheus/client_model v0.2.0 // indirect
	github.com/prometheus/common v0.26.0 // indirect
	github.com/prometheus/procfs v0.6.0 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/uber/jaeger-client-go v2.29.1+incompatible // indirect
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	go.uber.org/atomic v1.8.0 // indirect
	golang.org/x/net v0.0.0-20210520170846-37e1c6afe023 // indirect
	golang.org/x/sys v0.0.0-20210616094352-59db8d763f22 // indirect
	golang.org/x/text v0.3.6 // indirect
	golang.org/x/time v0.0.0-20210723032227-1f47c861a9ac // indirect
	google.golang.org/genproto v0.0.0-20210602131652-f16073e35f0c // indirect
	google.golang.org/grpc v1.39.1 // indirect
	google.golang.org/protobuf v1.27.1 // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace github.com/gitpod-io/gitpod/registry-facade => ../registry-facade // leeway

replace github.com/gitpod-io/gitpod/registry-facade/api => ../registry-facade-api/go // leeway

replace k8s.io/api => k8s.io/api v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.22.0 // leeway indirect from components/common-go:lib

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.22.0 // leeway indirect from components/common-go:lib
