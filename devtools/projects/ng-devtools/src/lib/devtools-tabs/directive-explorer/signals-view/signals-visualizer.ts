/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import * as d3 from 'd3';

let arrowDefId = 0;

export interface SignalTreeNode {
  children: SignalTreeNode[]; 
  name: string;
}

export type SignalsGraphD3Node = d3.HierarchyPointNode<SignalTreeNode>;

export abstract class GraphRenderer<T, U> {
  abstract render(graph: T): void;
  abstract getNodeById(id: string): U | null;
  abstract snapToNode(node: U): void;
  abstract snapToRoot(): void;
  abstract zoomScale(scale: number): void;
  abstract root: U | null;
  abstract get graphElement(): HTMLElement;

  protected nodeClickListeners: ((pointerEvent: PointerEvent, node: U) => void)[] = [];
  protected nodeMouseoverListeners: ((pointerEvent: PointerEvent, node: U) => void)[] = [];
  protected nodeMouseoutListeners: ((pointerEvent: PointerEvent, node: U) => void)[] = [];

  cleanup(): void {
    this.nodeClickListeners = [];
    this.nodeMouseoverListeners = [];
    this.nodeMouseoutListeners = [];
  }

  onNodeClick(cb: (pointerEvent: PointerEvent, node: U) => void): void {
    this.nodeClickListeners.push(cb);
  }

  onNodeMouseover(cb: (pointerEvent: PointerEvent, node: U) => void): void {
    this.nodeMouseoverListeners.push(cb);
  }

  onNodeMouseout(cb: (pointerEvent: PointerEvent, node: U) => void): void {
    this.nodeMouseoutListeners.push(cb);
  }
}

interface SignalsGraphVisualizerConfig {
  orientation: 'horizontal' | 'vertical';
  nodeSize: [width: number, height: number];
  nodeSeparation: (nodeA: SignalsGraphD3Node, nodeB: SignalsGraphD3Node) => number;
  nodeLabelSize: [width: number, height: number];
}

export class SignalsGraphVisualizer extends GraphRenderer<SignalTreeNode, SignalsGraphD3Node> {
  public config: SignalsGraphVisualizerConfig;

  constructor(
    private _containerElement: HTMLElement,
    private _graphElement: HTMLElement,
    {
      orientation = 'horizontal',
      nodeSize = [200, 500],
      nodeSeparation = () => 2,
      nodeLabelSize = [250, 60],
    }: Partial<SignalsGraphVisualizerConfig> = {},
  ) {
    super();

    this.config = {
      orientation,
      nodeSize,
      nodeSeparation,
      nodeLabelSize,
    };
  }

  private d3 = d3;

  override root: SignalsGraphD3Node | null = null;
  zoomController: d3.ZoomBehavior<HTMLElement, unknown> | null = null;

  override zoomScale(scale: number) {
    if (this.zoomController) {
      this.zoomController.scaleTo(
        this.d3.select<HTMLElement, unknown>(this._containerElement),
        scale,
      );
    }
  }

  override snapToRoot(scale = 1): void {
    if (this.root) {
      this.snapToNode(this.root, scale);
    }
  }

  override snapToNode(node: SignalsGraphD3Node, scale = 1): void {
    const svg = this.d3.select(this._containerElement);
    const halfWidth = this._containerElement.clientWidth / 2;
    const halfHeight = this._containerElement.clientHeight / 2;
    const t = d3.zoomIdentity.translate(halfWidth - node.y, halfHeight - node.x).scale(scale);
    svg.transition().duration(500).call(this.zoomController!.transform, t);
  }

  override get graphElement(): HTMLElement {
    return this._graphElement;
  }

  override getNodeById(id: string): SignalsGraphD3Node | null {
    const selection = this.d3
      .select<HTMLElement, SignalsGraphD3Node>(this._containerElement)
      .select(`.node[data-id="${id}"]`);
    if (selection.empty()) {
      return null;
    }
    return selection.datum();
  }

  override cleanup(): void {
    super.cleanup();
    this.d3.select(this._graphElement).selectAll('*').remove();
  }

  override render(injectorGraph: SignalTreeNode): void {
    // cleanup old graph
    this.cleanup();

    const data = this.d3.hierarchy(injectorGraph, (node: SignalTreeNode) => node.children);
    const tree = this.d3.tree<SignalTreeNode>();
    const svg = this.d3.select(this._containerElement);
    const g = this.d3.select<HTMLElement, SignalsGraphD3Node>(this._graphElement);

    this.zoomController = this.d3.zoom<HTMLElement, unknown>().scaleExtent([0.1, 2]);
    this.zoomController.on('start zoom end', (e: {transform: number}) => {
      g.attr('transform', e.transform);
    });
    svg.call(this.zoomController);

    // Compute the new tree layout.
    tree.nodeSize(this.config.nodeSize);
    tree.separation((a: SignalsGraphD3Node, b: SignalsGraphD3Node) => {
      return this.config.nodeSeparation(a, b);
    });

    const nodes = tree(data);
    this.root = nodes;

    arrowDefId++;
    svg
      .append('svg:defs')
      .selectAll('marker')
      .data([`end${arrowDefId}`]) // Different link/path types can be defined here
      .enter()
      .append('svg:marker') // This section adds in the arrows
      .attr('id', String)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('class', 'arrow')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    g.selectAll('.link')
      .data(nodes.descendants().slice(1))
      .enter()
      .append('path')
      .attr('class', (node: SignalsGraphD3Node) => {
      

        return `link`;
      })
      .attr('marker-end', `url(#end${arrowDefId})`)
      .attr('d', (node: SignalsGraphD3Node) => {
        const parent = node.parent!;
        if (this.config.orientation === 'horizontal') {
          return `
                    M${node.y},${node.x}
                    C${(node.y + parent.y) / 2},
                      ${node.x} ${(node.y + parent.y) / 2},
                      ${parent.x} ${parent.y},
                      ${parent.x}`;
        }

        return `
              M${node.x},${node.y}
              C${(node.x + parent.x) / 2},
                ${node.y} ${(node.x + parent.x) / 2},
                ${parent.y} ${parent.x},
                ${parent.y}`;
      });

    // Declare the nodes
    const node = g
      .selectAll('g.node')
      .data(nodes.descendants())
      .enter()
      .append('g')
      .attr('class', (node: SignalsGraphD3Node) => {
        
        return `node`;
      })
      .on('click', (pointerEvent: PointerEvent, node: SignalsGraphD3Node) => {
        this.nodeClickListeners.forEach((listener) => listener(pointerEvent, node));
      })
      .on('mouseover', (pointerEvent: PointerEvent, node: SignalsGraphD3Node) => {
        this.nodeMouseoverListeners.forEach((listener) => listener(pointerEvent, node));
      })
      .on('mouseout', (pointerEvent: PointerEvent, node: SignalsGraphD3Node) => {
        this.nodeMouseoutListeners.forEach((listener) => listener(pointerEvent, node));
      })

      .attr('transform', (node: SignalsGraphD3Node) => {
        if (this.config.orientation === 'horizontal') {
          return `translate(${node.y},${node.x})`;
        }

        return `translate(${node.x},${node.y})`;
      });

    const [width, height] = this.config.nodeLabelSize!;

    node
      .append('foreignObject')
      .attr('width', width)
      .attr('height', height)
      .attr('x', -1 * (width - 10))
      .attr('y', -1 * (height / 2))
      .append('xhtml:div')
      .attr('class', (node: SignalsGraphD3Node) => {
        return 'node-container';
      })
      .html((node: SignalsGraphD3Node) => {
        const label = node.data.name;
        const lengthLimit = 25;
        return label.length > lengthLimit
          ? label.slice(0, lengthLimit - '...'.length) + '...'
          : label;
      });

    svg.attr('height', '100%').attr('width', '100%');
  }
}
