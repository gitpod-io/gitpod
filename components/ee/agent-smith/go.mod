module github.com/gitpod-io/gitpod/agent-smith

go 1.14

require (
	github.com/alecthomas/jsonschema v0.0.0-20210413112511-5c9c23bdc720
	github.com/ashwanthkumar/slack-go-webhook v0.0.0-20181208062437-4a19b1a876b7
	github.com/cilium/ebpf v0.5.0
	github.com/davecgh/go-spew v1.1.1
	github.com/elazarl/goproxy v0.0.0-20191011121108-aa519ddbe484 // indirect
	github.com/elazarl/goproxy/ext v0.0.0-20191011121108-aa519ddbe484 // indirect
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/google/go-cmp v0.5.5
	github.com/h2non/filetype v1.0.8
	github.com/hashicorp/golang-lru v0.5.1
	github.com/moul/http2curl v1.0.0 // indirect
	github.com/parnurzeal/gorequest v0.2.15 // indirect
	github.com/prometheus/client_golang v1.9.0
	github.com/spf13/cobra v0.0.3
	golang.org/x/net v0.0.0-20210405180319-a5a99cb37ef4 // indirect
	golang.org/x/sys v0.0.0-20210510120138-977fb7262007
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	k8s.io/api v0.21.0
	k8s.io/apimachinery v0.21.0
)

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../../gitpod-protocol/go // leeway

replace k8s.io/api => k8s.io/api v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.20.4 // leeway indirect from gitpod-core/components/common-go:lib
