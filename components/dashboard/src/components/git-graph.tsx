/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';

// TODO Use Theme!
namespace Colors {
    export const fontColor2 = '#666';
    export const brand = '#1aa6e4';
}

export interface GraphElement {
    start?: [number, number];
    right?: number;
    left?: number;
    down?: number;
    up?: number;
    onClick?: () => void;
    isActive?: () => boolean;
    fork?: GraphElement[];
}


interface GitGraphProps {
    graph: GraphElement[];
    top?: number;
    left?: number;
    width?: number;
}

type Direction = 'l'|'r'|'u'|'d'|undefined;

interface SVGGraph {
    pathes: string[];
    dots: {x: number, y:number, onClick?: () => void, isActive?: () => boolean}[];
    maxHeight: number;
}

const r = 20;
const circleRadius = '6';
const strokeWidth = 1;

function toPath(graph: GraphElement[], direction?: Direction, x?: number, y?: number): SVGGraph {
    let result: SVGGraph = {
        pathes: [x === undefined ? '' : `M${x},${y}`],
        dots: [],
        maxHeight: 0
    };
    let d:Direction = direction;
    let currentX = x || 0;
    let currentY = y || 0;

    for (const e of graph) {
        if (e.fork instanceof Array) {
            const sub = toPath(e.fork, d, currentX, currentY);
            result.pathes.push(...sub.pathes);
            result.dots.push(...sub.dots);
            result.maxHeight = Math.max(sub.maxHeight, result.maxHeight);
        } else {
            if (e.start) {
                currentX = e.start[0];
                currentY = e.start[1];
                result.pathes[0] += `M${currentX},${currentY}`;
            } else if (e.down) {
                let reduce = 0;
                if (d === 'r') {
                    result.pathes[0]+=`c ${r},0 ${r},${r} ${r},${r}`;
                    reduce = r;
                    currentX += reduce;
                } else if (d === 'l') {
                    result.pathes[0]+=`c -${r},0 -${r},${r} -${r},${r}`;
                    reduce = r;
                    currentX -= reduce;
                }
                currentY += e.down;
                result.maxHeight = Math.max(currentY, result.maxHeight);
                d = 'd';
                result.pathes[0] += `l0,${e.down - reduce}`;
            } else if (e.up) {
                //TODO not used yet
                d = 'u';
                result.pathes[0] += `l0,-${e.up}`;
            } else if (e.right) {
                let reduce = 0;
                if (d === 'd') {
                    result.pathes[0]+=`c 0,${r} ${r},${r} ${r},${r}`;
                    reduce = r;
                    currentY += reduce;
                    result.maxHeight = Math.max(currentY, result.maxHeight);
                }
                currentX += e.right;
                d = 'r';
                result.pathes[0] += `l${e.right - reduce},0`;
            } else if (e.left) {
                let reduce = 0;
                if (d === 'd') {
                    result.pathes[0]+= `c 0,${r} -${r},${r} -${r},${r}`;
                    reduce = r;
                    currentY -= reduce;
                }
                currentX -= e.left;
                d = 'l';
                result.pathes[0] += `l-${e.left - reduce},0`;
            } else {
                result.dots.push({
                    x: currentX,
                    y: currentY,
                    onClick: e.onClick,
                    isActive: e.isActive
                })
            }
        }
    }
    return result;
}

const GitGraph: React.SFC<GitGraphProps> = (p) => {
    const g = toPath(p.graph);
    const theWidth = p.width || 9200;
    return <div style={{
            position: 'absolute',
            left: p.left || -50,
            top: p.top || -50,
            zIndex: -1,
            width: theWidth+'px'
            }}>
            <svg xmlns="http://www.w3.org/2000/svg"
                 viewBox={`0 0 ${theWidth} ${g.maxHeight + 20}`}
                 className="hidden-md-down"
                 >
                <g>
                    {
                        g.pathes.map(p => <path
                            key={p}
                            d={p}
                            fill="none"
                            stroke={Colors.fontColor2}
                            strokeWidth={strokeWidth}
                        />)
                    }
                    {
                        g.dots.map(d => <circle
                            key={`${d.x}_${d.y}`}
                            x={d.x}
                            y={d.y}
                            r={circleRadius}
                            transform={`translate(${d.x} ${d.y})`}
                            fill={!d.isActive || d.isActive() ? Colors.brand : Colors.fontColor2}
                            stroke='none'
                            onClick={d.onClick}
                        />)
                    }
                </g>
            </svg>
        </div>;
}

export default GitGraph;
