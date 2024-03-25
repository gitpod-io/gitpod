package toolbox.gateway.sample

import kotlinx.serialization.Serializable

@Serializable
data class EnvironmentDTO(
    val id: String,
    val name: String,
)

@Serializable
data class EnvironmentsDTO(
    val environments: List<EnvironmentDTO>
)
