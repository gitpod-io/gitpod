// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
	ContentService  Versioned `json:"contentService"`
	Dashboard       Versioned `json:"dashboard"`
	DBMigrations    Versioned `json:"dbMigrations"`
	DBSync          Versioned `json:"dbSync"`
	IAM             Versioned `json:"iam"`
	IDEProxy        Versioned `json:"ideProxy"`
	IDEMetrics      Versioned `json:"ideMetrics"`
	IDEService      Versioned `json:"ideService"`
	ImageBuilderMk3 struct {
		Versioned
		BuilderImage Versioned `json:"builderImage"`
	} `json:"imageBuilderMk3"`
	OpenVSXProxy      Versioned `json:"openVSXProxy"`
	Proxy             Versioned `json:"proxy"`
	PublicAPIServer   Versioned `json:"public-api-server"`
	RefreshCredential Versioned `json:"refreshCredential"`
	RegistryFacade    Versioned `json:"registryFacade"`
	Server            Versioned `json:"server"`
	ServiceWaiter     Versioned `json:"serviceWaiter"`
	Usage             Versioned `json:"usage"`
	Workspace         struct {
		CodeImage             Versioned `json:"codeImage"`
		CodeHelperImage       Versioned `json:"codeHelperImage"`
		CodeWebExtensionImage Versioned `json:"codeWebExtensionImage"`
		XtermWebImage         Versioned `json:"xtermWebImage"`
		DockerUp              Versioned `json:"dockerUp"`
		Supervisor            Versioned `json:"supervisor"`
		Workspacekit          Versioned `json:"workspacekit"`
		DesktopIdeImages      struct {
			CodeDesktopImage                  Versioned `json:"codeDesktop"`
			CodeDesktopImageInsiders          Versioned `json:"codeDesktopInsiders"`
			IntelliJImage                     Versioned `json:"intellij"`
			IntelliJLatestImage               Versioned `json:"intellijLatest"`
			GoLandImage                       Versioned `json:"goland"`
			GoLandLatestImage                 Versioned `json:"golandLatest"`
			PyCharmImage                      Versioned `json:"pycharm"`
			PyCharmLatestImage                Versioned `json:"pycharmLatest"`
			PhpStormImage                     Versioned `json:"phpstorm"`
			PhpStormLatestImage               Versioned `json:"phpstormLatest"`
			RubyMineImage                     Versioned `json:"rubymine"`
			RubyMineLatestImage               Versioned `json:"rubymineLatest"`
			WebStormImage                     Versioned `json:"webstorm"`
			WebStormLatestImage               Versioned `json:"webstormLatest"`
			RiderImage                        Versioned `json:"rider"`
			RiderLatestImage                  Versioned `json:"riderLatest"`
			CLionImage                        Versioned `json:"clion"`
			CLionLatestImage                  Versioned `json:"clionLatest"`
			RustRoverImage                    Versioned `json:"rustrover"`
			RustRoverLatestImage              Versioned `json:"rustroverLatest"`
			JetBrainsBackendPluginImage       Versioned `json:"jbBackendPlugin"`
			JetBrainsBackendPluginLatestImage Versioned `json:"jbBackendPluginLatest"`
			JetBrainsLauncherImage            Versioned `json:"jbLauncher"`
		} `json:"desktopIdeImages"`
	} `json:"workspace"`
	WSDaemon struct {
		Versioned

		UserNamespaces struct {
			SeccompProfileInstaller Versioned `json:"seccompProfileInstaller"`
		} `json:"userNamespaces"`
	} `json:"wsDaemon"`
	WSManager       Versioned `json:"wsManager"`
	WSManagerMk2    Versioned `json:"wsManagerMk2"`
	WSManagerBridge Versioned `json:"wsManagerBridge"`
	WSProxy         Versioned `json:"wsProxy"`
	NodeLabeler     Versioned `json:"node-labeler"`

	ImageBuilderNG Versioned `json:"imageBuilderNG"`
	WSManagerNG    Versioned `json:"wsManagerNG"`
	WorkspacekitNG Versioned `json:"workspacekitNG"`
	WSDaemonNg     Versioned `json:"wsDaemonNg"`
}

func Embedded() (*Manifest, error) {
	return loadEmbedded()
}
