module github.com/gitpod-io/gitpod/installation-telemetry

go 1.17

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/spf13/cobra v1.3.0
	gopkg.in/segmentio/analytics-go.v3 v3.1.0
)

require (
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/segmentio/backo-go v1.0.0 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c // indirect
	golang.org/x/sys v0.0.0-20211205182925-97ca703d548d // indirect
)

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway
