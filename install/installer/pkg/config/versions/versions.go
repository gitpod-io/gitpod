// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package versions

type Manifest struct {
	Version    string     `json:"version"`
	Components Components `json:"components"`
}

type Versioned struct {
	Version string `json:"version"`
}

type Components struct {
	AgentSmith      Versioned `json:"agentSmith"`
	Blobserve       Versioned `json:"blobserve"`
	CAUpdater       Versioned `json:"caUpdater"`
	ContentService  Versioned `json:"contentService"`
	Dashboard       Versioned `json:"dashboard"`
	DBMigrations    Versioned `json:"dbMigrations"`
	DBSync          Versioned `json:"dbSync"`
	IDEProxy        Versioned `json:"ideProxy"`
	ImageBuilder    Versioned `json:"imageBuilder"`
	ImageBuilderMk3 struct {
		Versioned
		BuilderImage Versioned `json:"builderImage"`
	} `json:"imageBuilderMk3"`
	InstallationTelemetry Versioned `json:"installationTelemetry"`
	IntegrationTests      Versioned `json:"integrationTests"`
	Kedge                 Versioned `json:"kedge"`
	OpenVSXProxy          Versioned `json:"openVSXProxy"`
	PaymentEndpoint       Versioned `json:"paymentEndpoint"`
	Proxy                 Versioned `json:"proxy"`
	PublicAPIServer       Versioned `json:"public-api-server"`
	RegistryFacade        Versioned `json:"registryFacade"`
	Server                Versioned `json:"server"`
	ServiceWaiter         Versioned `json:"serviceWaiter"`
	Workspace             struct {
		CodeImage        Versioned `json:"codeImage"`
		DockerUp         Versioned `json:"dockerUp"`
		Supervisor       Versioned `json:"supervisor"`
		Workspacekit     Versioned `json:"workspacekit"`
		DesktopIdeImages struct {
			CodeDesktopImage         Versioned `json:"codeDesktop"`
			CodeDesktopImageInsiders Versioned `json:"codeDesktopInsiders"`
			IntelliJImage            Versioned `json:"intellij"`
			IntelliJLatestImage      Versioned `json:"intellijLatest"`
			GoLandImage              Versioned `json:"goland"`
			GoLandLatestImage        Versioned `json:"golandLatest"`
			PyCharmImage             Versioned `json:"pycharm"`
			PyCharmLatestImage       Versioned `json:"pycharmLatest"`
			PhpStormImage            Versioned `json:"phpstorm"`
			PhpStormLatestImage      Versioned `json:"phpstormLatest"`
		} `json:"desktopIdeImages"`
	} `json:"workspace"`
	WSDaemon struct {
		Versioned

		UserNamespaces struct {
			SeccompProfileInstaller Versioned `json:"seccompProfileInstaller"`
			ShiftFSModuleLoader     Versioned `json:"shiftfsModuleLoader"`
		} `json:"userNamespaces"`
	} `json:"wsDaemon"`
	WSManager       Versioned `json:"wsManager"`
	WSManagerBridge Versioned `json:"wsManagerBridge"`
	WSProxy         Versioned `json:"wsProxy"`
}

// var embedded embed.FS

func Embedded() (*Manifest, error) {
	return loadEmbedded()
}
