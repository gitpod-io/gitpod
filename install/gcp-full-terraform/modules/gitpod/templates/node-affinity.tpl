affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
      - matchExpressions:
        - key: gitpod.io/workload_meta
          operator: In
          values:
          - "true"

components:
  workspace:
    template:
      spec:
        affinity:
          nodeAffinity:
            requiredDuringSchedulingIgnoredDuringExecution:
              nodeSelectorTerms:
              - matchExpressions:
                - key: gitpod.io/workload_workspace
                  operator: In
                  values:
                  - "true"