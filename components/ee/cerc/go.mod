module github.com/gitpod-io/gitpod/cerc

go 1.14

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/jeremywohl/flatten v1.0.1
	github.com/prometheus/client_golang v1.1.0
	github.com/satori/go.uuid v1.2.0
	github.com/sirupsen/logrus v1.4.2
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
)

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

replace k8s.io/api => k8s.io/api v0.0.0-20190918155943-95b840bb6a1f // leeway indirect from components/common-go:lib

replace k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.0.0-20190918161926-8f644eb6e783 // leeway indirect from components/common-go:lib

replace k8s.io/apimachinery => k8s.io/apimachinery v0.0.0-20190913080033-27d36303b655 // leeway indirect from components/common-go:lib

replace k8s.io/apiserver => k8s.io/apiserver v0.0.0-20190918160949-bfa5e2e684ad // leeway indirect from components/common-go:lib

replace k8s.io/cli-runtime => k8s.io/cli-runtime v0.0.0-20190918162238-f783a3654da8 // leeway indirect from components/common-go:lib

replace k8s.io/client-go => k8s.io/client-go v0.0.0-20190918160344-1fbdaa4c8d90 // leeway indirect from components/common-go:lib

replace k8s.io/cloud-provider => k8s.io/cloud-provider v0.0.0-20190918163234-a9c1f33e9fb9 // leeway indirect from components/common-go:lib

replace k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.0.0-20190620090013-c9a0fc045dc1 // leeway indirect from components/common-go:lib

replace k8s.io/code-generator => k8s.io/code-generator v0.15.12-beta.0 // leeway indirect from components/common-go:lib

replace k8s.io/component-base => k8s.io/component-base v0.0.0-20190620085130-185d68e6e6ea // leeway indirect from components/common-go:lib

replace k8s.io/cri-api => k8s.io/cri-api v0.0.0-20190531030430-6117653b35f1 // leeway indirect from components/common-go:lib

replace k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.0.0-20190620090116-299a7b270edc // leeway indirect from components/common-go:lib

replace k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.0.0-20190620085325-f29e2b4a4f84 // leeway indirect from components/common-go:lib

replace k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.0.0-20190620085942-b7f18460b210 // leeway indirect from components/common-go:lib

replace k8s.io/kube-proxy => k8s.io/kube-proxy v0.0.0-20190620085809-589f994ddf7f // leeway indirect from components/common-go:lib

replace k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.0.0-20190620085912-4acac5405ec6 // leeway indirect from components/common-go:lib

replace k8s.io/kubelet => k8s.io/kubelet v0.0.0-20190620085838-f1cb295a73c9 // leeway indirect from components/common-go:lib

replace k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.0.0-20190620090156-2138f2c9de18 // leeway indirect from components/common-go:lib

replace k8s.io/metrics => k8s.io/metrics v0.0.0-20190620085625-3b22d835f165 // leeway indirect from components/common-go:lib

replace k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.0.0-20190620085408-1aef9010884e // leeway indirect from components/common-go:lib
