#!/bin/bash

deploymentName="server"
debugPort="9229"

echo "Storing the original deployment configuration in a file"
kubectl get deployment $deploymentName -o json > original_deployment_$deploymentName.json

function restore {
  echo "Restoring the original deployment configuration and stop port forwarding"
  kubectl replace --force -f original_deployment_$deploymentName.json
  rm original_deployment_$deploymentName.json
}
trap restore EXIT

echo "Add the inspect flag and debug port to the configuration"
jq '.spec.template.spec.containers[0].command = ["yarn", "start-inspect"]' original_deployment_$deploymentName.json > new_deployment_$deploymentName.json

echo "Apply the new configuration"
kubectl apply -f new_deployment_$deploymentName.json
rm new_deployment_$deploymentName.json

echo "Scale down to one pod"
kubectl scale deployment $deploymentName --replicas=1

echo "Get the pod to forward the port from"
podName=$(kubectl get pod -l component=$deploymentName -o jsonpath='{.items[0].metadata.name}')

echo "Forward the port $debugPort of $podName to localhost. Waiting for a debugger to attach ..."
kubectl port-forward "$podName" $debugPort:$debugPort
