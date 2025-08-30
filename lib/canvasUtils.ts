export interface CanvasNode {
  id: string;
  type: string;
  data: {
    title: string;
    subtitle?: string;
    icon: string;
    color: string;
  };
  position: {
    x: number;
    y: number;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface CanvasFlow {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export class CanvasUtils {
  /**
   * Generate a unique node ID
   */
  static generateNodeId(type: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${type}-${timestamp}-${random}`;
  }

  /**
   * Generate a unique edge ID
   */
  static generateEdgeId(sourceId: string, targetId: string): string {
    return `edge-${sourceId}-${targetId}`;
  }

  /**
   * Create a new node at the specified position
   */
  static createNode(
    type: string,
    position: { x: number; y: number },
    data: Partial<CanvasNode['data']> = {}
  ): CanvasNode {
    const nodeTypes: Record<string, CanvasNode['data']> = {
      email: {
        title: "이메일",
        subtitle: "이메일 마케팅",
        icon: "fas fa-envelope",
        color: "blue",
      },
      landing: {
        title: "랜딩페이지",
        subtitle: "제품 소개",
        icon: "fas fa-window-maximize",
        color: "green",
      },
      social: {
        title: "소셜미디어",
        subtitle: "SNS 마케팅",
        icon: "fas fa-share-alt",
        color: "purple",
      },
      sms: {
        title: "SMS",
        subtitle: "문자 마케팅",
        icon: "fas fa-sms",
        color: "orange",
      },
      payment: {
        title: "결제",
        subtitle: "체크아웃",
        icon: "fas fa-shopping-cart",
        color: "red",
      },
      automation: {
        title: "자동화",
        subtitle: "워크플로우",
        icon: "fas fa-robot",
        color: "indigo",
      },
    };

    const defaultData = nodeTypes[type] || nodeTypes.email;

    return {
      id: this.generateNodeId(type),
      type,
      data: { ...defaultData, ...data },
      position,
    };
  }

  /**
   * Create an edge between two nodes
   */
  static createEdge(
    sourceId: string,
    targetId: string,
    label?: string
  ): CanvasEdge {
    return {
      id: this.generateEdgeId(sourceId, targetId),
      source: sourceId,
      target: targetId,
      label,
    };
  }

  /**
   * Calculate the center point between two nodes
   */
  static getNodeCenter(node: CanvasNode): { x: number; y: number } {
    return {
      x: node.position.x + 80, // node width / 2
      y: node.position.y + 40, // node height / 2
    };
  }

  /**
   * Generate SVG path for an edge between two nodes
   */
  static generateEdgePath(
    sourceNode: CanvasNode,
    targetNode: CanvasNode
  ): string {
    const source = this.getNodeCenter(sourceNode);
    const target = this.getNodeCenter(targetNode);

    const midX = (source.x + target.x) / 2;

    // Create a smooth curve
    return `M ${source.x} ${source.y} Q ${midX} ${source.y} ${target.x} ${target.y}`;
  }

  /**
   * Check if two nodes overlap
   */
  static nodesOverlap(node1: CanvasNode, node2: CanvasNode): boolean {
    const nodeWidth = 160;
    const nodeHeight = 80;
    const padding = 20;

    const rect1 = {
      left: node1.position.x - padding,
      top: node1.position.y - padding,
      right: node1.position.x + nodeWidth + padding,
      bottom: node1.position.y + nodeHeight + padding,
    };

    const rect2 = {
      left: node2.position.x,
      top: node2.position.y,
      right: node2.position.x + nodeWidth,
      bottom: node2.position.y + nodeHeight,
    };

    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom
    );
  }

  /**
   * Find a non-overlapping position for a new node
   */
  static findNonOverlappingPosition(
    existingNodes: CanvasNode[],
    preferredPosition: { x: number; y: number }
  ): { x: number; y: number } {
    let position = { ...preferredPosition };
    let attempts = 0;
    const maxAttempts = 50;
    const stepSize = 40;

    while (attempts < maxAttempts) {
      const tempNode = this.createNode("temp", position);
      const hasOverlap = existingNodes.some(node => 
        this.nodesOverlap(tempNode, node)
      );

      if (!hasOverlap) {
        return position;
      }

      // Try different positions in a spiral pattern
      const angle = (attempts * 0.5) * Math.PI;
      const radius = Math.floor(attempts / 4) * stepSize;
      position = {
        x: preferredPosition.x + Math.cos(angle) * radius,
        y: preferredPosition.y + Math.sin(angle) * radius,
      };

      attempts++;
    }

    // If no non-overlapping position found, return preferred position
    return preferredPosition;
  }

  /**
   * Auto-arrange nodes in a flow layout
   */
  static autoArrangeNodes(flow: CanvasFlow): CanvasFlow {
    if (flow.nodes.length === 0) return flow;

    const arrangedNodes: CanvasNode[] = [];
    const visited = new Set<string>();
    const startX = 100;
    const startY = 100;
    const xSpacing = 200;
    const ySpacing = 150;

    // Find root nodes (nodes with no incoming edges)
    const rootNodes = flow.nodes.filter(node => 
      !flow.edges.some(edge => edge.target === node.id)
    );

    // If no root nodes, use the first node
    if (rootNodes.length === 0 && flow.nodes.length > 0) {
      rootNodes.push(flow.nodes[0]);
    }

    let currentY = startY;

    // Arrange nodes level by level
    rootNodes.forEach((rootNode, rootIndex) => {
      const levelY = currentY + (rootIndex * ySpacing);
      this.arrangeNodeHierarchy(
        rootNode,
        flow,
        { x: startX, y: levelY },
        xSpacing,
        ySpacing,
        arrangedNodes,
        visited
      );
    });

    return {
      ...flow,
      nodes: arrangedNodes,
    };
  }

  private static arrangeNodeHierarchy(
    node: CanvasNode,
    flow: CanvasFlow,
    position: { x: number; y: number },
    xSpacing: number,
    ySpacing: number,
    arrangedNodes: CanvasNode[],
    visited: Set<string>,
    level: number = 0
  ): void {
    if (visited.has(node.id)) return;

    visited.add(node.id);
    arrangedNodes.push({
      ...node,
      position: {
        x: position.x + (level * xSpacing),
        y: position.y,
      },
    });

    // Find child nodes
    const childEdges = flow.edges.filter(edge => edge.source === node.id);
    const childNodes = childEdges
      .map(edge => flow.nodes.find(n => n.id === edge.target))
      .filter(Boolean) as CanvasNode[];

    // Arrange child nodes
    childNodes.forEach((childNode, index) => {
      this.arrangeNodeHierarchy(
        childNode,
        flow,
        {
          x: position.x,
          y: position.y + ((index + 1) * ySpacing),
        },
        xSpacing,
        ySpacing,
        arrangedNodes,
        visited,
        level + 1
      );
    });
  }

  /**
   * Validate flow structure
   */
  static validateFlow(flow: CanvasFlow): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for duplicate node IDs
    const nodeIds = flow.nodes.map(n => n.id);
    const duplicateIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate node IDs: ${duplicateIds.join(", ")}`);
    }

    // Check for invalid edges
    flow.edges.forEach(edge => {
      const sourceExists = flow.nodes.some(n => n.id === edge.source);
      const targetExists = flow.nodes.some(n => n.id === edge.target);
      
      if (!sourceExists) {
        errors.push(`Edge ${edge.id} references non-existent source node: ${edge.source}`);
      }
      if (!targetExists) {
        errors.push(`Edge ${edge.id} references non-existent target node: ${edge.target}`);
      }
    });

    // Check for circular dependencies
    if (this.hasCircularDependency(flow)) {
      errors.push("Circular dependency detected in flow");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static hasCircularDependency(flow: CanvasFlow): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCircle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const childEdges = flow.edges.filter(edge => edge.source === nodeId);
      for (const edge of childEdges) {
        if (hasCircle(edge.target)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of flow.nodes) {
      if (hasCircle(node.id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Export flow to JSON
   */
  static exportFlow(flow: CanvasFlow): string {
    return JSON.stringify(flow, null, 2);
  }

  /**
   * Import flow from JSON
   */
  static importFlow(jsonString: string): CanvasFlow {
    try {
      const flow = JSON.parse(jsonString);
      const validation = this.validateFlow(flow);
      
      if (!validation.isValid) {
        throw new Error(`Invalid flow: ${validation.errors.join(", ")}`);
      }
      
      return flow;
    } catch (error) {
      throw new Error(`Failed to import flow: ${(error as Error).message}`);
    }
  }
}
