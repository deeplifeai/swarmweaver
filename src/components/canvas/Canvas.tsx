import React, { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  Connection,
  Edge,
  useReactFlow,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';
import { AgentNode } from './AgentNode';
import { useAgentStore } from '@/store/agentStore';
import { generateAgentResponse } from '@/services/ai-service';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { AgentExecutionResult } from '@/types/agent';

const nodeTypes: NodeTypes = {
  agent: AgentNode,
};

export function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState('swarm-output');

  const storeNodes = useAgentStore((state) => state.nodes);
  const storeEdges = useAgentStore((state) => state.edges);
  const agents = useAgentStore((state) => state.agents);
  const executionResults = useAgentStore((state) => state.executionResults);
  const { setViewport } = useReactFlow();

  React.useEffect(() => {
    setNodes(storeNodes.map(node => ({
      id: node.id,
      type: 'agent',
      position: node.position,
      data: node.data,
      draggable: true,
    })));
    
    setEdges(storeEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      useAgentStore.getState().addEdge({
        source: connection.source as string,
        target: connection.target as string,
        animated: true,
      });
    },
    []
  );

  const onEdgeDelete = useCallback(
    (edge: Edge) => {
      useAgentStore.getState().removeEdge(edge.id);
    },
    []
  );

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: any) => {
      useAgentStore.getState().updateNode(node.id, {
        position: node.position,
      });
    },
    []
  );

  const getNodeDependencies = (nodeId: string): string[] => {
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    return incomingEdges.map(edge => edge.source);
  };

  const getOutputs = (nodeId: string): string[] => {
    const node = storeNodes.find(n => n.id === nodeId);
    return node?.data.outputs || [];
  };

  const getNodeAgentConfig = (nodeId: string) => {
    const node = storeNodes.find(n => n.id === nodeId);
    if (!node || !node.data.agentId) return null;
    
    const agent = agents.find(a => a.id === node.data.agentId);
    if (!agent) return null;
    
    return agent;
  };

  const processNode = async (nodeId: string, processedNodes: Set<string>): Promise<AgentExecutionResult> => {
    if (processedNodes.has(nodeId)) {
      return executionResults[nodeId] || { 
        nodeId, 
        output: '', 
        status: 'completed' 
      };
    }

    const node = storeNodes.find(n => n.id === nodeId);
    if (!node) {
      return {
        nodeId,
        output: '',
        status: 'error',
        error: 'Node not found'
      };
    }

    useAgentStore.getState().setExecutionResult({
      nodeId,
      output: '',
      status: 'running'
    });

    try {
      const dependencies = getNodeDependencies(nodeId);
      const dependencyOutputs: string[] = [];
      
      for (const depNodeId of dependencies) {
        const result = await processNode(depNodeId, processedNodes);
        if (result.status === 'error') {
          throw new Error(`Dependency error: ${result.error}`);
        }
        dependencyOutputs.push(result.output);
      }

      let output = '';
      
      if (node.type === 'output') {
        output = [...node.data.inputs, ...dependencyOutputs].join('\n\n---\n\n');
      } else {
        const agent = getNodeAgentConfig(nodeId);
        if (!agent) {
          throw new Error('No agent configuration found for this node');
        }

        const combinedInput = [
          ...node.data.inputs,
          ...dependencyOutputs
        ].join('\n\n---\n\n');

        if (!combinedInput) {
          throw new Error('No input provided for agent');
        }

        output = await generateAgentResponse(
          agent.provider,
          agent.model,
          agent.systemPrompt,
          combinedInput
        );
      }

      useAgentStore.getState().setNodeOutput(nodeId, output);
      processedNodes.add(nodeId);
      
      const result = {
        nodeId,
        output,
        status: 'completed' as const
      };
      
      useAgentStore.getState().setExecutionResult(result);
      return result;
    } catch (error: any) {
      const result = {
        nodeId,
        output: '',
        status: 'error' as const,
        error: error.message || 'Unknown error'
      };
      
      useAgentStore.getState().setExecutionResult(result);
      console.error(`Error processing node ${nodeId}:`, error);
      toast.error(`Error processing node: ${error.message}`);
      return result;
    }
  };

  const runCanvas = async () => {
    try {
      setIsRunning(true);
      useAgentStore.getState().clearExecutionResults();
      
      const outputNodes = storeNodes.filter(node => node.data.label === 'Output Box');
      
      if (outputNodes.length === 0) {
        throw new Error('No output node found in canvas');
      }
      
      const processedNodes = new Set<string>();
      
      for (const outputNode of outputNodes) {
        await processNode(outputNode.id, processedNodes);
      }
      
      toast.success('Canvas execution completed');
    } catch (error: any) {
      toast.error(`Failed to run canvas: ${error.message}`);
      console.error('Run canvas error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const downloadOutput = async () => {
    try {
      const outputNodes = storeNodes.filter(node => node.data.label === 'Output Box');
      
      if (outputNodes.length === 0) {
        throw new Error('No output node found in canvas');
      }
      
      const zip = new JSZip();
      
      outputNodes.forEach((node, index) => {
        const outputs = node.data.outputs;
        if (outputs.length > 0) {
          const filename = outputNodes.length > 1 
            ? `output-${index + 1}.txt` 
            : 'output.txt';
          
          zip.file(filename, outputs.join('\n\n---\n\n'));
        }
      });
      
      zip.file('README.txt', 'This file contains outputs from your AI agent swarm.\nCreated with SwarmWeaver.');
      
      const content = await zip.generateAsync({ type: 'blob' });
      
      saveAs(content, `${downloadFilename}.zip`);
      setDownloadDialogOpen(false);
      
      toast.success('Output downloaded successfully');
    } catch (error: any) {
      toast.error(`Download failed: ${error.message}`);
      console.error('Download error:', error);
    }
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const reactFlow = document.querySelector('.react-flow');
      
      const flow = reactFlow?.getBoundingClientRect();
      
      if (!reactFlowBounds || !flow) return;

      const type = event.dataTransfer.getData('application/reactflow');
      
      if (!type) return;

      let data;
      try {
        data = JSON.parse(event.dataTransfer.getData('application/reactflow/data'));
      } catch (e) {
        console.error('Failed to parse drag data', e);
        return;
      }

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top
      };

      useAgentStore.getState().addNode({
        type: 'agent',
        position,
        data
      });
    },
    [reactFlowWrapper]
  );

  return (
    <div className="w-full h-full" ref={reactFlowWrapper}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeDoubleClick={(_, edge) => onEdgeDelete(edge)}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          className="bg-slate-50"
        >
          <Background variant="dots" gap={20} color="#e2e8f0" />
          <Controls />
          <Panel position="top-right" className="flex gap-2">
            <Button
              variant="default"
              onClick={runCanvas}
              disabled={isRunning || storeNodes.length === 0}
              className="shadow-md hover:shadow-lg transition-all"
            >
              {isRunning ? 'Running...' : 'Run Canvas'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDownloadDialogOpen(true)}
              disabled={
                isRunning || 
                !storeNodes.some(node => 
                  node.data.label === 'Output Box' && node.data.outputs.length > 0
                )
              }
              className="shadow-md hover:shadow-lg transition-all"
            >
              Download Output
            </Button>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>

      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="sm:max-w-md glass-panel animate-scale-in">
          <DialogHeader>
            <DialogTitle>Download Output</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="filename" className="text-sm font-medium">
                Filename
              </label>
              <input
                id="filename"
                value={downloadFilename}
                onChange={(e) => setDownloadFilename(e.target.value)}
                placeholder="Enter filename (without extension)"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDownloadDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={downloadOutput}>
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
