module github.com/gitpod-io/gitpod/ws-daemon

go 1.16

// containerd, see https://github.com/containerd/containerd/issues/3031
replace github.com/docker/distribution v2.7.1+incompatible => github.com/docker/distribution v2.7.1-0.20190205005809-0d3efadf0154+incompatible // leeway ignore

replace github.com/docker/docker v1.13.1 => github.com/docker/engine v17.12.0-ce-rc1.0.20200514230353-811a247d06e8+incompatible // leeway ignore

require (
	github.com/Microsoft/go-winio v0.4.16 // indirect
	github.com/Microsoft/hcsshim v0.8.14 // indirect
	github.com/Microsoft/hcsshim/test v0.0.0-20210209090606-7bf6ec3b3171 // indirect
	github.com/StackExchange/wmi v0.0.0-20190523213315-cbe66965904d // indirect
	github.com/alecthomas/jsonschema v0.0.0-20190504002508-159cbd5dba26
	github.com/alecthomas/repr v0.0.0-20200325044227-4184120f674c
	github.com/containerd/cgroups v0.0.0-20200824123100-0b889c03f102 // indirect
	github.com/containerd/containerd v1.4.1
	github.com/containerd/continuity v0.0.0-20210208174643-50096c924a4e // indirect
	github.com/containerd/fifo v0.0.0-20200410184934-f15a3290365b // indirect
	github.com/containerd/go-runc v0.0.0-20200930051345-7c5957f67ef4 // indirect
	github.com/containerd/ttrpc v1.0.2 // indirect
	github.com/containerd/typeurl v1.0.1
	github.com/docker/docker v1.13.1
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ws-daemon/api v0.0.0-00010101000000-000000000000
	github.com/go-ole/go-ole v1.2.4 // indirect
	github.com/gogo/googleapis v1.4.0 // indirect
	github.com/google/go-cmp v0.5.2
	github.com/grpc-ecosystem/go-grpc-middleware v1.2.2
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
	github.com/opencontainers/go-digest v1.0.0
	github.com/opencontainers/image-spec v1.0.1
	github.com/opencontainers/runc v0.1.1 // indirect
	github.com/opencontainers/runtime-spec v1.0.2
	github.com/opencontainers/selinux v1.6.0 // indirect
	github.com/opentracing/opentracing-go v1.1.0
	github.com/prometheus/client_golang v1.1.0
	github.com/shirou/gopsutil v2.20.9+incompatible
	github.com/sirupsen/logrus v1.7.0
	github.com/spf13/cobra v1.1.1
	github.com/syndtr/gocapability v0.0.0-20200815063812-42c35b437635 // indirect
	go.etcd.io/bbolt v1.3.5 // indirect
	golang.org/x/sys v0.0.0-20210110051926-789bb1bd4061
	golang.org/x/time v0.0.0-20200630173020-3af7569d3a1e
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/grpc v1.36.0
	google.golang.org/protobuf v1.25.0
	gotest.tools/v3 v3.0.3 // indirect
	k8s.io/api v0.20.4
	k8s.io/apimachinery v0.20.4
	k8s.io/client-go v0.0.0
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway

replace github.com/gitpod-io/gitpod/content-service => ../content-service // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../content-service-api/go // leeway

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
