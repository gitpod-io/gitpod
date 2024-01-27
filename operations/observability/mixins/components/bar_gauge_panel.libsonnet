/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

{
  /**
   * Create a [bar gauge panel](https://grafana.com/docs/grafana/latest/panels/visualizations/bar-gauge-panel/),
   *
   * @name barGaugePanel.new
   *
   * @param title Panel title.
   * @param description (optional) Panel description.
   * @param datasource (optional) Panel datasource.
   * @param unit (optional) The unit of the data.
   * @param decimals (optional) Number of decimal.
   * @param thresholds (optional) An array of threashold values.
   * @param values (optional) Bool if show values
   * @param calcs (optional) An array of type of calculation
   * @param fields (optional) string - fields that should be included in the panel
   * @param orientation (optional) string (horizontal or vertical)
   * @param displayMode (optional) string (eg. lcd)
   * @param showUnfilled (optional) bool if showUnfilled
   * @param color (optional) string
   *
   * @method addTarget(target) Adds a target object.
   * @method addTargets(targets) Adds an array of targets.
   */
  new(
    title,
    description=null,
    datasource=null,
    unit=null,
    decimals=null,
    thresholds=[],
    values=false,
    calcs=['mean'],
    fields='',
    orientation='auto',
    displayMode='gradient',
    showUnfilled=true,
    color=null
  ):: {
    type: 'bargauge',
    title: title,
    [if description != null then 'description']: description,
    datasource: datasource,
    targets: [
    ],
    fieldConfig: {
      defaults: {
        [if decimals != null then 'decimals']: decimals,
        unit: unit,
        [if color != null then 'color']: color,
        thresholds: {
          mode: 'absolute',
          steps: thresholds,
        },
      },
    },
    _nextTarget:: 0,
    addTarget(target):: self {
      // automatically ref id in added targets.
      local nextTarget = super._nextTarget,
      _nextTarget: nextTarget + 1,
      targets+: [target { refId: std.char(std.codepoint('A') + nextTarget) }],
    },
    addTargets(targets):: std.foldl(function(p, t) p.addTarget(t), targets, self),
    options: {
      reduceOptions: {
        values: values,
        calcs: calcs,
        fields: fields,
      },
      orientation: orientation,
      displayMode: displayMode,
      showUnfilled: showUnfilled,
    },
  },
}
