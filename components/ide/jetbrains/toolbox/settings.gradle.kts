rootProject.name = "gitpod-toolbox-gateway"

include(":supervisor-api")
val supervisorApiProjectPath: String by settings
project(":supervisor-api").projectDir = File(supervisorApiProjectPath)

include(":gitpod-publicapi")
val gitpodPublicApiProjectPath: String by settings
project(":gitpod-publicapi").projectDir = File(gitpodPublicApiProjectPath)
