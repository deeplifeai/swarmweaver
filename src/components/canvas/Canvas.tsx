import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
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
  BackgroundVariant,
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
  const [downloadFormat, setDownloadFormat] = useState<'json' | 'text'>('json');

  const storeNodes = useAgentStore((state) => state.nodes);
  const storeEdges = useAgentStore((state) => state.edges);
  const agents = useAgentStore((state) => state.agents);
  const executionResults = useAgentStore((state) => state.executionResults);
  const saveCanvasState = useAgentStore((state) => state.saveCanvasState);
  const exportCanvasToFile = useAgentStore((state) => state.exportCanvasToFile);
  const clearCanvas = useAgentStore((state) => state.clearCanvas);
  const clearAgents = useAgentStore((state) => state.clearAgents);
  const { setViewport } = useReactFlow();

  useEffect(() => {
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
      console.info('onConnect called with connection:', connection);
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
      console.info('onEdgeDelete called with edge:', edge);
      useAgentStore.getState().removeEdge(edge.id);
    },
    []
  );

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: any) => {
      console.info('onNodeDragStop triggered for node:', node);
      useAgentStore.getState().updateNode(node.id, {
        position: node.position,
      });
    },
    []
  );

  const onNodeDelete = useCallback(
    (event: React.MouseEvent, node: any) => {
      console.info('onNodeDelete triggered for node:', node);
      useAgentStore.getState().removeNode(node.id);
    },
    []
  );

  const onNodesDelete = useCallback(
    (nodes: any[]) => {
      console.info('onNodesDelete triggered for nodes:', nodes.map(n => n.id));
      nodes.forEach(node => {
        useAgentStore.getState().removeNode(node.id);
      });
    },
    []
  );

  const getNodeDependencies = useCallback((nodeId: string): string[] => {
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    return incomingEdges.map(edge => edge.source);
  }, [edges]);

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
    console.info(`Starting processing for node ${nodeId}`);

    // If we've already processed this node, return its cached result
    if (processedNodes.has(nodeId)) {
      const cachedResult = executionResults[nodeId];
      if (cachedResult) {
        console.info(`Node ${nodeId} already processed. Returning cached result.`);
        return cachedResult;
      }
    }

    const node = storeNodes.find(n => n.id === nodeId);
    if (!node) {
      const errorMsg = 'Node not found';
      console.error(`Error: ${errorMsg} for node ${nodeId}`);
      return {
        nodeId,
        output: '',
        status: 'error',
        error: errorMsg
      };
    }

    // Mark node as running
    useAgentStore.getState().setExecutionResult({
      nodeId,
      output: '',
      status: 'running'
    });

    try {
      // Process dependencies first
      const dependencies = getNodeDependencies(nodeId);
      console.info(`Node ${nodeId} dependencies:`, dependencies);
      const dependencyResults = await Promise.all(
        dependencies.map(depId => processNode(depId, processedNodes))
      );

      // Check if any dependencies failed
      const failedDependency = dependencyResults.find(result => result.status === 'error');
      if (failedDependency) {
        throw new Error(`Dependency error: ${failedDependency.error}`);
      }

      const dependencyOutputs = dependencyResults.map(result => result.output);

      let output = '';
      if (node.data.label === 'Output Box') {
        output = [...node.data.inputs, ...dependencyOutputs].join('\n\n---\n\n');
      } else {
        const agent = getNodeAgentConfig(nodeId);
        if (!agent) {
          const errorMsg = 'No agent configuration found for this node';
          console.error(`Error in node ${nodeId}: ${errorMsg}`);
          throw new Error(errorMsg);
        }
        console.info(`Node ${nodeId} using agent ${agent.id || 'unknown'} (provider: ${agent.provider})`);

        const combinedInput = [
          ...node.data.inputs,
          ...dependencyOutputs
        ].join('\n\n---\n\n');

        if (!combinedInput) {
          throw new Error('No input provided for agent');
        }

        console.info(`Generating agent response for node ${nodeId}`);
        output = await generateAgentResponse(
          agent.provider,
          agent.model,
          agent.systemPrompt,
          combinedInput
        );
        console.info(`Agent response received for node ${nodeId}`);
      }

      useAgentStore.getState().setNodeOutput(nodeId, output);
      processedNodes.add(nodeId);
      
      const result = {
        nodeId,
        output,
        status: 'completed' as const
      };
      
      useAgentStore.getState().setExecutionResult(result);
      console.info(`Node ${nodeId} processed successfully`);
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
    console.info('Starting canvas run with', storeNodes.length, 'nodes');
    try {
      const processedNodes = new Set<string>();
      
      // Log each output node to be processed
      console.info('Processing output nodes:', storeNodes.filter(n => n.data.label === 'Output Box').map(n => n.id));
      
      for (const outputNode of storeNodes.filter(n => n.data.label === 'Output Box')) {
        console.info(`Processing output node: ${outputNode.id}`);
        await processNode(outputNode.id, processedNodes);
      }
      
      toast.success('Canvas execution completed');
      console.info('Canvas run completed successfully');
    } catch (error: any) {
      toast.error(`Failed to run canvas: ${error.message}`);
      console.error('Run canvas error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const parseOutputContent = (outputs: string[]): string => {
    if (downloadFormat === 'json') {
      try {
        // Try to parse each output as JSON, or wrap it in a text field if it's not valid JSON
        const parsedOutputs = outputs.map(output => {
          try {
            return JSON.parse(output);
          } catch (e) {
            return { text: output };
          }
        });
        return JSON.stringify(parsedOutputs, null, 2);
      } catch (e) {
        console.error('Error parsing JSON:', e);
        return outputs.join('\n\n---\n\n');
      }
    } else {
      return outputs.join('\n\n---\n\n');
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
          const fileExtension = downloadFormat === 'json' ? 'json' : 'txt';
          const filename = outputNodes.length > 1 
            ? `output-${index + 1}.${fileExtension}` 
            : `output.${fileExtension}`;
          
          zip.file(filename, parseOutputContent(outputs));
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
    console.info('onDragOver triggered', event);
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      console.info('onDrop triggered', event);
      
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
        data: {
          ...data,
          inputs: [],
          outputs: []
        }
      });
      console.info('Node added via drop at position:', position, 'with data:', data);
    },
    [reactFlowWrapper]
  );

  // Memoize expensive calculations
  const outputNodes = useMemo(() => {
    return storeNodes.filter(node => node.data.label === 'Output Box');
  }, [storeNodes]);

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
          onNodesDelete={onNodesDelete}
          nodeTypes={nodeTypes}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          className="bg-slate-50"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} color="#e2e8f0" />
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
              onClick={saveCanvasState}
              className="shadow-md hover:shadow-lg transition-all"
            >
              Save Canvas
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const selectedNode = nodes.find(n => n.selected);
                if (selectedNode && selectedNode.data.agentId) {
                  useAgentStore.getState().saveAgentToLibrary(selectedNode);
                  toast.success('Agent saved to library');
                } else {
                  toast.error('Please select an agent node first');
                }
              }}
              className="shadow-md hover:shadow-lg transition-all"
            >
              Save Agent to Library
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
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Are you sure you want to clear the canvas? This will remove all nodes and connections.")) {
                  clearCanvas();
                }
              }}
              className="shadow-md hover:shadow-lg transition-all"
            >
              Clear Canvas
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Are you sure you want to clear all saved agents? This action cannot be undone.")) {
                  clearAgents();
                }
              }}
              className="shadow-md hover:shadow-lg transition-all"
            >
              Clear Saved Agents
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
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Format
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value="json"
                    checked={downloadFormat === 'json'}
                    onChange={() => setDownloadFormat('json')}
                    className="mr-2"
                  />
                  <span className="text-sm">JSON</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value="text"
                    checked={downloadFormat === 'text'}
                    onChange={() => setDownloadFormat('text')}
                    className="mr-2"
                  />
                  <span className="text-sm">Plain Text</span>
                </label>
              </div>
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
