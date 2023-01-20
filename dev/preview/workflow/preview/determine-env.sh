#!/usr/bin/env bash

# this is meant to be sourced by the deploy script

# If we're IN CI, quit for now
if [ -n "${GITHUB_ACTIONS-}" ] || [ -n "${WERFT_SERVICE_HOST-}" ]; then
  return
fi

if [ -n "${TF_VAR_infra_provider-}" ]; then
  return
fi

state_output=$(terraform_output "infra_provider")
# If we don't have the provider_choice in the outputs, bail. This is temporary until all envs have it set
if [[ "${state_output}" != "harvester" && "${state_output}" != "gce" ]]; then
  return
fi

# Reuse the one we set in the state and exit
# Otherwise if we haven't set it, the default value of the variable will be reused and might overwrite a change
# A bit hacky for now, but will prevent destruction if you run it once with GCE, and next time you don't set the var explicitly
export TF_VAR_infra_provider=$state_output
return

# Leaving this unreachable for now
options=("harvester" "gce")
provider_choice=$(choose "Choose your infra provider" "${options[@]}")

if [ "${state_output}" != "${provider_choice}" ]; then
  ask "You have chosen [${provider_choice}], but in the state we have [${state_output}]. Continuing will destroy and recreate your environment. Are you sure?"
  export TF_VAR_infra_provider=${provider_choice}
  return
fi
