module github.com/gitpod-io/gitpod/server-api/proxy

go 1.17

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/server/api v0.0.0-00010101000000-000000000000
	github.com/hashicorp/golang-lru v0.5.4
	github.com/urfave/cli/v2 v2.3.0
	google.golang.org/grpc v1.43.0
)

require (
	github.com/cpuguy83/go-md2man/v2 v2.0.0-20190314233015-f79a8a8ca69d // indirect
	github.com/golang/mock v1.6.0 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/gorilla/websocket v1.4.2 // indirect
	github.com/russross/blackfriday/v2 v2.0.1 // indirect
	github.com/shurcooL/sanitized_anchor_name v1.0.0 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/sourcegraph/jsonrpc2 v0.0.0-20200429184054-15c2290dcb37 // indirect
	golang.org/x/net v0.0.0-20210520170846-37e1c6afe023 // indirect
	golang.org/x/sys v0.0.0-20210616094352-59db8d763f22 // indirect
	golang.org/x/text v0.3.6 // indirect
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1 // indirect
	google.golang.org/genproto v0.0.0-20220107163113-42d7afdf6368 // indirect
	google.golang.org/protobuf v1.27.1 // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/server/api => ../go // leeway

replace k8s.io/api => k8s.io/api v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/component-helpers => k8s.io/component-helpers v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/controller-manager => k8s.io/controller-manager v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/kubectl => k8s.io/kubectl v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/mount-utils => k8s.io/mount-utils v0.22.2 // leeway indirect from components/common-go:lib

replace k8s.io/pod-security-admission => k8s.io/pod-security-admission v0.22.2 // leeway indirect from components/common-go:lib
