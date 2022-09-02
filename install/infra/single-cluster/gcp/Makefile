##
# Terraform AWS reference architecture
#

.PHONY: init
init:
	@terraform init

touch-kubeconfig:
	@touch kubeconfig

cleanup-kubeconfig:
	@rm kubeconfig

.PHONY: plan
plan: touch-kubeconfig plan-cluster plan-cm-edns cleanup-kubeconfig

.PHONY: apply
apply: apply-cluster apply-tools

.PHONY: destroy
destroy: destroy-tools destroy-cluster

.PHONY: refresh
refresh:
	@echo "Refreshing terraform state"
	@terraform refresh
	@echo ""
	@echo "Done!"

.PHONY: output
output: refresh output-done-msg output-url output-nameservers output-registry output-database output-storage output-issuer

output-done-msg:
	@echo ""
	@echo ""
	@echo "=========================="
	@echo "🎉🥳🔥🧡🚀"
	@echo "Your cloud infrastructure is ready to install Gitpod. Please visit"
	@echo "https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod"
	@echo "for your next steps."
	@echo "================="
	@echo "Config Parameters"
	@echo "================="

output-url:
	@echo ""
	@echo "Gitpod domain name:"
	@echo "================="
	@terraform output -json url | jq

output-nameservers:
	@echo ""
	@echo "🟢 Nameservers for the domain(to be added as NS records in your domain provider):"
	@echo "================="
	@terraform output -json nameservers | jq

output-storage:
	@echo ""
	@echo "🟢 Object storage:"
	@echo "=============="
	@echo "Choose 'GCP' Storage provider"
	@echo ""
	@echo "Storage region = $$(terraform output -json storage | yq r - region)"
	@echo "Project ID     = $$(terraform output -json storage | yq r - project)"
	@echo "Service account key = Upload the file 'gs-credentials.json' created in this directory"
	@terraform output -json storage | yq r - service_account_key > gs-credentials.json
	@echo ""

output-registry:
	@echo ""
	@echo "🟢 GCR registry:"
	@echo "=================="
	@echo "Container registry URL      = $$(terraform output -json registry | yq r - url)"
	@echo "Container registry server   = $$(terraform output -json registry | yq r - server)"
	@echo "Container registry username = $$(terraform output -json registry | yq r - username)"
	@echo "Container registry password = Copy paste the following JSON key"
	@echo ""
	@terraform output -json registry | yq r - password

output-database:
	@echo ""
	@echo "🟢 Database:"
	@echo "========"
	@echo "Tick the option 'Use Google Cloud SQL Proxy' if using this database"
	@echo ""
	@echo "CloudSQL connection name = $$(terraform output -json database | yq r - instance)"
	@echo "Username 				= $$(terraform output -json database | yq r - username)"
	@echo "Password 				= $$(terraform output -json database | yq r - password)"
	@echo "GCP service account key  = Upload the file 'mysql-credentials.json' created in this directory"
	@terraform output -json database | yq r - service_account_key > mysql-credentials.json
	@echo ""

output-issuer:
	@echo ""
	@echo "🟢 ClusterIssuer name:"
	@echo "================="
	@terraform output -json cluster_issuer | jq

.PHONY: plan-cluster
plan-cluster:
	@terraform plan -target=module.gke

.PHONY: plan-tools
plan-tools: plan-cm-edns plan-cluster-issuer

.PHONY: plan-cm-edns
plan-cm-edns:
	@terraform plan -target=module.certmanager -target=module.externaldns

.PHONY: plan-cluster-issuer
plan-cluster-issuer:
	@terraform plan -target=module.cluster-issuer

.PHONY: apply-cluster
apply-cluster:
	@terraform apply -target=module.gke --auto-approve

.PHONY: apply-tools
apply-tools: install-cm-edns install-cluster-issuer

.PHONY: install-cm-edns
install-cm-edns:
	@terraform apply -target=module.certmanager -target=module.externaldns --auto-approve

.PHONY: install-cluster-issuer
install-cluster-issuer:
	@terraform apply -target=module.cluster-issuer  --auto-approve

.PHONY: destroy-cluster
destroy-cluster:
	@terraform destroy -target=module.gke --auto-approve

.PHONY: destroy-tools
destroy-tools: destroy-cluster-issuer destroy-cm-edns

.PHONY: destroy-cm-edns
destroy-cm-edns:
	@terraform destroy -target=module.certmanager  -target=module.externaldns --auto-approve

.PHONY: destroy-cluster-issuer
destroy-cluster-issuer:
	@terraform destroy -target=module.cluster-issuer  --auto-approve || echo "Could not remove cluster-issuer"

# end
