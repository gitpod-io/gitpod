# Gitpod's Mixin

Gitpod's mixin is based on the [Prometheus Monitoring Mixins project](https://github.com/monitoring-mixins/docs/blob/master/design.pdf). Mixins are jsonnet packages that bundle together [Prometheus Alerts](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/), [Prometheus Recording Rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/) and [Grafana Dashboards](https://grafana.com/grafana/).

## Table of contents

* [Folders and Teams](#Folders-and-Teams)
* [How to develop Dashboards](#How-to-develop-Dashboards)
    * [Grafonnet](#Grafonnet)
    * [Exporting JSONs from Grafana UI](#Exporting-JSONs-from-Grafana-UI)
* [How to develop Prometheus Alerts and Rules](#How-to-develop-Prometheus-Alerts-and-Rules)
    * [Recording Rules](#Recording-Rules)
    * [Alerts](#Alerts)
    * [Rules and Alerts validation](#Rules-and-Alerts-validation)
* [Deploying merged changes to production](#Deploying-merged-changes-to-production)
* [Frequently asked Questions](#FAQ)
    * [Any recommendations when developing new dashboards?](#Any-recommendations-when-developing-new-dashboards)
    * [How is our mixin consumed?](#How-is-our-mixin-consumed)
    * [How do I review dashboards before merging PRs?](#How-do-I-review-dashboards-before-merging-PRs)
    * [Do I configure alerting routes in the mixin?](#Do-I-configure-alerting-routes-in-the-mixin)


## Folders and Teams

Folders are organized following Gitpod as an organization, while also adding an extra folder for dashboards and alerts that involves multiple teams (Good place for broad overviews and SLOs):
* Meta
* Workspace
* IDE
* Cross-Teams (For dashboards and alerts that are co-owned by more than one team)

We've organized our mixins to make it easier to each team to own their dashboards and alerts. Every team has its own folder with a `mixin.libsonnet` file, which imports all dashboards and alerts from the subfolders.

It doesn't matter how the imports inside the subfolders work, it is only important that all dashboards end up in a `grafanaDashboards` object, all alerts in the `prometheusAlerts` object and all recording rules in the `prometheusRules` object. [Read more about jsonnet objects](https://jsonnet.org/ref/language.html).

From past experiences, the platform team suggests that dashboards and alerts get split by component inside the subfolders because, so far, we haven't implemented metrics that involves more than a single component operation.


## How to develop Dashboards

### Grafonnet

Grafana provides a jsonnet library, called [Grafonnet](https://github.com/grafana/grafonnet-lib/tree/master/grafonnet), that can help us develop Grafana dashboards while keeping amount of code low.

Instead of creating a gigantic JSON, you can use grafonnet and make a dashboard that is a lot easier to review in Pull Requests. For example:

```jsonnet
// content of my-team/dashboards/my-new-dashboard.libsonnet
local grafana = import 'grafonnet/grafana.libsonnet';
local dashboard = grafana.dashboard;
local row = grafana.row;
local prometheus = grafana.prometheus;
local template = grafana.template;
local graphPanel = grafana.graphPanel;
local template = grafana.template;

local datasourceVariable = {
  hide: 0,
  name: 'datasource',
  query: 'prometheus',
  refresh: 1,
  type: 'datasource',
};

local runningWorkspacesGraph =
  graphPanel.new(
    'Running Workspaces',
    datasource='$datasource',
    format='none',
    stack=false,
    fill=1,
    fillGradient=5,
    min=0,
  )
  .addTarget(
      prometheus.target(
          |||
            sum(
              gitpod_ws_manager_workspace_phase_total{phase="RUNNING"}
            ) by (type)
          |||, legendFormat='{{ type }}'
      )
  );

{
    'my-new-dashboard.json': dashboard.new(
    'My new dashboard!',
    time_from='now-1h',
    timezone='utc',
    refresh='30s',
    )
    .addTemplate(datasourceVariable)
    .addPanel(runningWorkspacesGraph)
    ,
}




/*******************************/
// content of my-team/dashboards.libsonnet
{
    grafanaDashboards+:: {
        // other dashboards
        ...
        ...
        ...
        'my-new-dashboard.json': (import 'my-team/dashboards/my-new-dashboard.libsonnet'),
    }
}
```

To make sure your jsonnet code compiles and is well-formated, you can always run `make lint`.

You can also use our [preview environments to make sure the dashboard really looks like what you imagined](#How-do-I-review-dashboards-before-merging-PRs).

### Exporting JSONs from Grafana UI

[Jsonnet is a simple extension of JSON](https://jsonnet.org/), which means that valid JSON is also valid Jsonnet.

Grafana has built-in functionality that lets us export dashboards as JSON files, which we can import to our mixins. Below you find a quick video explaining how to add a new dashboard to our mixin, exporting from Grafana's UI.

https://www.loom.com/share/23356f272a894801acc4f16bb3fd635a

## How to develop Prometheus Alerts and Rules

### Recording Rules

[Recording rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/) is a feature of Prometheus that pre-computes the value of a PromQL expression and saves it into a brand-new metric. This brand new metric can then be used in Alerts and Dashboards. Recording rules are often used to:

* Pre-calculate expensive queries that often freezes Grafana Dashboards
* Simplify alerts that may require super complicated queries. Instead of adding a new alert with a super complicated query, create a new metric with its value and alert on this new metric.

It doesn't matter how they are imported from each teams' `mixin.libsonnet` file, the only requirement is that they endup in an object called `prometheusRules`.

Some examples!

Importing json files:
```jsonnet
// content of my-team/rules/components/my-component/rules.json
{
  "groups": [
    {
      "name": "example",
      "rules": [
        {
          "record": "instance_path:requests:rate5m",
          "expr": "rate(requests_total{job=\"myjob\"}[5m])"
        },
        {
          "record": "path:requests:rate5m",
          "expr": "sum without (instance)(instance_path:requests:rate5m{job=\"myjob\"})"
        }
      ]
    }
  ]
}


// content of my-team/rules/components.libsonnet
{
  prometheusRules+:: {} +
  (import './my-component/rules.json'),
}
```

Directly importing inside the `prometheusRules` object:
```jsonnet
// content of my-team/rules/components.libsonnet
{
  prometheusRules+:: {
    groups+: [
      {
        name: 'example',
        rules: [
          {
            record: 'instance_path:requests:rate5m',
            expr: 'rate(requests_total{job="myjob"}[5m])',
          },
          {
            record: 'path:requests:rate5m',
            expr: 'sum without (instance)(instance_path:requests:rate5m{job="myjob"})',
          },
        ],
      },
    ],
  },
}
```

When developing new recording rules, please use [Prometheus' recording rule naming convention](https://prometheus.io/docs/practices/rules/).

### Alerts

[Alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/) are definitions of alerts, where you can optionally include additional metadata to them.

Alerting rules that we develop have a direct impact on the reliability of our systems, and also on the pressure put on top of the person on-call. To make the duty of the person on-call more efficient, and reduce stress at the same time, we require that every new `critical` alert has a corresponding runbook at the [observability repository](https://github.com/gitpod-io/observability). Please don't forget to open a new Pull Request there!

It doesn't matter how they are imported from each teams' `mixin.libsonnet` file, the only requirement is that they end up in an object called `prometheusAlerts`.

Some examples!

Importing json files:
```jsonnet
// content of my-team/rules/components/my-component/alerts.json
{
  "groups": [
    {
      "name": "example",
      "rules": [
        {
          "alert": "HighRequestLatency",
          "expr": "job:request_latency_seconds:mean5m{job=\"myjob\"} > 0.5",
          "for": "10m",
          "labels": {
            "severity": "critical"
          },
          "annotations": {
            "summary": "High request latency"
          }
        }
      ]
    }
  ]
}


// content of my-team/rules/components.libsonnet
{
  prometheusAlerts+:: {} +
  (import './my-component/alerts.json'),
}
```

Directly importing inside the `prometheusAlerts` object:
```jsonnet
// content of my-team/rules/components.libsonnet
{
  prometheusAlerts+:: {
    groups: [
      {
        name: 'example',
        rules: [
          {
            alert: 'HighRequestLatency',
            expr: 'job:request_latency_seconds:mean5m{job="myjob"} > 0.5',
            'for': '10m',
            labels: {
              severity: 'page',
            },
            annotations: {
              summary: 'High request latency',
            },
          },
        ],
      },
    ],
  },
}
```

For further explanation of Prometheus Alerts, please head to the [official documentation](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/).


### Rules and Alerts validation

You can use our Makefile to make sure the alerts and recording rules you've created are valid (They will break prometheus if they aren't).

By running `make promtool-lint`, you'll generate a new file called `prometheus_alerts.yaml` with all teams' recording rules and alerts together, and also use the `promtool` binary to validate all of them.

We also have this same validation running in our CI, to make sure we don't merge stuff that can break our monitoring system.

## Deploying merged changes to production

Alright, you got your changes merged, now what? The changes need to land on our [gitpod-io/observability](https://github.com/gitpod-io/observability) repository by updating the `vendor/` folder.

The `vendor/` folder can be updated by triggering this [workflow](https://github.com/gitpod-io/observability/actions/workflows/dep-update.yaml). Yes, you just need to click the button and the workflow will open a new Pull Request with the updates.

After all CI checks pass, it is safe to merge the Pull Request. It is now ArgoCD's duty to synchronize the monitoring-satellite applications across all clusters. If you want to check progress, you can do that through [ArgoCD UI](https://argo-cd.gitpod-io-dev.com/applications?labels=application%253Dmonitoring-satellite).

## FAQ

### Any recommendations when developing new dashboards?

Each team owns their dashboards, feel free to create what is the most useful to you. We only recommend keeping things simple.

It's tempting to add every simple piece of information in a dashboard, however, it adds a lot of noise and you soon have a hard time finding what you really care about.

[The Prometheus team has some good recommendations that you could follow.](https://prometheus.io/docs/practices/consoles/)

### How is our mixin consumed?

They are consumed by our git repository with the monitoring system configuration. To be more precise, a jsonnet package manager(jsonnet-bundler) can import jsonnet code from git repositories, as long as they are added to the [jsonnetfile.json](https://github.com/gitpod-io/observability/blob/main/jsonnetfile.json).

This `jsonnetfile.json` lists all dependencies that we use, which includes this very mixin. While also pointing to the specific version of each dependency(A git branch or commit SHA).

### How do I review dashboards before merging PRs?

There are a couple of options to trigger a werft job that will deploy a preview environment with Prometheus+Grafana with your changes:

#### Pull request description

By adding werft annotations to Pull Request descriptions, you make sure that all following job will have those annotations set.

The following combination of annotations can be used to deploy monitoring satellite
* Use harvester previews. Monitoring-satellite is deployed on those previews by default
```
/werft with-vm=true
# Just in case your PR requires extra configuration on Prometheus side (and you have a new branch on https://github.com/gitpod-io/observability with such changes)
# You can add the line below
/werft withObservabilityBranch=<my-branch>
```

* Use Gitpod helm charts to deploy a preview, and add the observability annotation
```
/werft with-helm=true with-observability=true
# Just in case your PR requires extra configuration on Prometheus side (and you have a new branch on https://github.com/gitpod-io/observability with such changes)
# You can add the line below
/werft withObservabilityBranch=<my-branch>
```

#### Github comment

If you want to run **one** particular job with different annotations, you can add them to a particular Github comment

```
/werft run with-vm=true
/werft run withObservabilityBranch=<my-branch>
```
or
```
/werft run with-helm=true with-observability=true
/werft run withObservabilityBranch=<my-branch>
```

#### Werft CLI inside a workspace

One last option is to open a workspace, then use Werft command line interface to start a job

```
werft run github -a with-vm=true # Optional-a withObservabilityBranch="<my-branch>"
```
or
```
werft run github -a with-helm=true -a with-observability=true # Optional-a withObservabilityBranch="<my-branch>"
```


As mentioned in [How is our mixin consumed?](#How-is-our-mixin-consumed), please remember that a commit must be done for us to update monitoring-satellite with the dashboards/alerts/recording rule changes.

Please remember that the annotation `withObservabilityBranch` is completely optional, and most of the time you won't need it at all.

### Do I configure alerting routes in the mixin?

No, mixins only contains alerts definition. The routing is done by alertmanager, which is configured in another git repository.
