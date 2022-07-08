module github.com/gitpod-io/gitpod/installation-telemetry

go 1.18

require (
	github.com/gitpod-io/gitpod/common-go/log v0.0.0-00010101000000-000000000000
	github.com/spf13/cobra v1.3.0
	gopkg.in/segmentio/analytics-go.v3 v3.1.0
)

require (
	github.com/bmizerany/assert v0.0.0-20160611221934-b7ed37b82869 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/segmentio/backo-go v1.0.0 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c // indirect
	golang.org/x/sys v0.0.0-20220114195835-da31bd327af9 // indirect
)

replace github.com/gitpod-io/gitpod/common-go/log => ../common-go/log // leeway
