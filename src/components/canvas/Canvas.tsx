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
import { formatCombinedInputs } from '@/utils/tokenManager';
import { processWithChunkedStrategy } from '@/services/optimizationService';

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
  const [outputsAvailable, setOutputsAvailable] = useState(false);

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

  // Keep outputsAvailable state in sync with node outputs
  useEffect(() => {
    const outputNodes = storeNodes.filter(n => n.data.label === 'Output Box');
    const hasOutputs = outputNodes.some(node => 
      node.data.outputs && node.data.outputs.length > 0
    );
    
    if (hasOutputs && !outputsAvailable) {
      console.info('Output nodes have data, enabling download button via effect');
      setOutputsAvailable(true);
    } else if (!hasOutputs && outputsAvailable) {
      console.info('No output data found, disabling download button via effect');
      setOutputsAvailable(false);
    }
  }, [storeNodes, outputsAvailable]);

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
        console.info(`Node ${nodeId} using agent ${agent.id || 'unknown'} (provider: ${agent.provider}, model: ${agent.model})`);
        console.info(`Agent system prompt: ${agent.systemPrompt ? agent.systemPrompt.substring(0, 50) + '...' : 'EMPTY OR UNDEFINED'}`);

        // Ensure system prompt is not null or undefined
        const systemPrompt = agent.systemPrompt || '';
        
        // Add a default system prompt if empty to prevent API errors
        const effectiveSystemPrompt = systemPrompt.trim().length === 0 ? 
          'You are a helpful AI assistant. Respond to the user input below in a clear and concise manner.' : 
          systemPrompt;

        // Use our improved format function for combined inputs
        const combinedInput = formatCombinedInputs([
          ...node.data.inputs,
          ...dependencyOutputs
        ]);

        if (!combinedInput) {
          throw new Error('No input provided for agent');
        }
        console.info(`Combined input for node ${nodeId} (length: ${combinedInput.length}): ${combinedInput.substring(0, 50)}...`);

        // We'll rely on generateAgentResponse to fetch the latest API key
        // This ensures we're using the most up-to-date keys

        console.info(`Generating agent response for node ${nodeId}`);
        try {
          // Check if input is very large and might benefit from chunked processing
          if (combinedInput.length > 10000) {
            console.info(`Node ${nodeId} has large input (${combinedInput.length} chars), using optimized processing`);
            // Get the API key for the provider
            const apiKey = useAgentStore.getState().apiKey[agent.provider];
            
            // Process with chunked strategy directly if input is very large
            output = await processWithChunkedStrategy(
              agent.provider,
              agent.model,
              effectiveSystemPrompt,
              combinedInput,
              apiKey
            );
          } else {
            // Standard processing for normal-sized inputs
            output = await generateAgentResponse(
              agent.provider,
              agent.model,
              effectiveSystemPrompt,
              combinedInput
            );
          }
          
          // Check if output indicates an error - handle both legacy and new formats
          if (output.startsWith('[Error:')) {
            throw new Error(output.substring(8, output.length - 1));
          }
          
          // Check for our special error format [ERROR::message]
          if (output.startsWith('[ERROR::')) {
            const errorMessage = output.substring(8, output.length - 1);
            console.error(`Error detected in agent response: ${errorMessage}`);
            throw new Error(errorMessage);
          }
          
          console.info(`Agent response received for node ${nodeId}`);
        } catch (apiError: any) {
          console.error(`API error for node ${nodeId}:`, apiError);
          throw new Error(`API error: ${apiError.message || 'Unknown API error'}`);
        }
      }

      // Check if output is empty but no error was thrown
      if (!output || output.trim().length === 0) {
        console.warn(`Empty output returned for node ${nodeId} without error`);
        output = "[Warning: Empty response received from the API]";
        
        // Mark as error instead of completed
        const result = {
          nodeId,
          output,
          status: 'error' as const,
          error: 'Empty response received from the API'
        };
        
        useAgentStore.getState().setExecutionResult(result);
        console.info(`Node ${nodeId} processed with error: Empty response`);
        return result;
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
      const errorMessage = error.message || 'Unknown error';
      console.error(`Error processing node ${nodeId}:`, error);
      
      // Set the error output in the node so it's visible to the user
      const errorOutput = `[Error: ${errorMessage}]`;
      useAgentStore.getState().setNodeOutput(nodeId, errorOutput);
      
      const result = {
        nodeId,
        output: errorOutput,
        status: 'error' as const,
        error: errorMessage
      };
      
      useAgentStore.getState().setExecutionResult(result);
      toast.error(`Error in node "${node.data.label}": ${errorMessage}`);
      return result;
    }
  };

  const runCanvas = async () => {
    console.info('Starting canvas run with', storeNodes.length, 'nodes');
    setOutputsAvailable(false); // Reset output availability state when starting a run
    try {
      const processedNodes = new Set<string>();
      
      // Log each output node to be processed
      console.info('Processing output nodes:', storeNodes.filter(n => n.data.label === 'Output Box').map(n => n.id));
      
      for (const outputNode of storeNodes.filter(n => n.data.label === 'Output Box')) {
        console.info(`Processing output node: ${outputNode.id}`);
        await processNode(outputNode.id, processedNodes);
      }
      
      // Check if any output nodes have data after the run is complete
      const outputNodes = storeNodes.filter(n => n.data.label === 'Output Box');
      const hasOutputs = outputNodes.some(node => 
        node.data.outputs && node.data.outputs.length > 0
      );
      
      if (hasOutputs) {
        console.info('Output nodes have data after execution, enabling download button');
        setOutputsAvailable(true);
      } else {
        console.warn('No output data found in output nodes after execution');
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

  const testDataFlowConnection = (sourceId: string, targetId: string) => {
    const sourceNode = storeNodes.find(n => n.id === sourceId);
    const targetNode = storeNodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) {
      console.error(`❌ Test failed: Could not find nodes for source ${sourceId} or target ${targetId}`);
      return false;
    }
    
    console.group(`🔍 Testing connection: ${sourceNode.data.label} (#${sourceId}) → ${targetNode.data.label} (#${targetId})`);
    
    // Check if source has outputs
    if (sourceNode.data.outputs.length === 0) {
      console.warn(`⚠️ Source node ${sourceNode.data.label} (#${sourceId}) has no outputs yet`);
      console.log(`ℹ️ This is normal if you haven't run the canvas yet. The connection is configured correctly, but no data has flowed through it.`);
      console.log(`ℹ️ To see actual data flow:`);
      console.log(`   1. Click "Run Canvas" to generate outputs for all nodes`);
      console.log(`   2. Or use "Generate Test Data" to create sample outputs`);
      console.log(`   3. Then run this test again to verify data is flowing properly`);
      
      // Check if the connection is properly configured at least
      const targetDeps = getNodeDependencies(targetId);
      if (targetDeps.includes(sourceId)) {
        console.log(`✅ Connection configuration looks good - target node lists source as a dependency`);
      } else {
        console.error(`❌ Connection may be improperly configured - target node does not list source as a dependency`);
      }
      
      console.groupEnd();
      return false;
    }
    
    // Log the source's last output
    const sourceOutput = sourceNode.data.outputs[sourceNode.data.outputs.length - 1];
    console.log(`📤 Source output: "${sourceOutput.substring(0, 100)}${sourceOutput.length > 100 ? '...' : ''}"`);
    
    // Check if the output is passed to the target's dependencies
    const targetDependencies = getNodeDependencies(targetId);
    if (!targetDependencies.includes(sourceId)) {
      console.error(`❌ Dependency configuration error: ${targetId} doesn't list ${sourceId} as a dependency`);
      console.groupEnd();
      return false;
    }
    
    console.log(`✅ Connection verified. The output from ${sourceNode.data.label} should be passed to ${targetNode.data.label}`);
    console.groupEnd();
    return true;
  };

  const testAllConnections = () => {
    console.group('🔍 Testing All Connections');
    
    if (storeEdges.length === 0) {
      console.warn('⚠️ No connections to test');
      console.groupEnd();
      toast.warning('No connections found in the canvas to test');
      return;
    }
    
    console.log(`Testing ${storeEdges.length} connections...`);
    console.log(`ℹ️ Note: If you haven't run the canvas yet, connections will show as "no outputs yet" - this is normal.`);
    
    const results = storeEdges.map(edge => {
      console.log(`Testing: ${edge.source} → ${edge.target}`);
      return testDataFlowConnection(edge.source, edge.target);
    });
    
    const passCount = results.filter(r => r === true).length;
    console.log(`✅ Test results: ${passCount}/${results.length} connections verified`);
    
    if (passCount === results.length) {
      toast.success(`All ${passCount} connections are properly configured`);
    } else {
      toast.warning(`${results.length - passCount} connection issues found. Check console for details.`);
    }
    
    console.groupEnd();
  };

  // Generate test outputs for nodes to facilitate testing without running the full canvas
  const generateTestOutputs = () => {
    console.log('Generating test outputs for all nodes...');
    
    const outputNodes = storeNodes.filter(n => n.data.label === 'Output Box');
    if (outputNodes.length === 0) {
      toast.warning('No output nodes found in canvas');
      return;
    }
    
    const currentTime = new Date().toLocaleTimeString();
    
    // Process each output node
    outputNodes.forEach(outputNode => {
      const dependencies = getNodeDependencies(outputNode.id);
      
      if (dependencies.length === 0) {
        // If there are no dependencies, create a warning output
        const warningOutput = `[Test Data at ${currentTime}] This output node has no connections.`;
        useAgentStore.getState().setNodeOutput(outputNode.id, warningOutput);
        
        const result = {
          nodeId: outputNode.id,
          output: warningOutput,
          status: 'completed' as const
        };
        useAgentStore.getState().setExecutionResult(result);
      } else {
        // Create combined test output from all upstream nodes
        const testInputs = dependencies.map(depId => {
          const depNode = storeNodes.find(n => n.id === depId);
          if (!depNode) return `[Test data from unknown node]`;
          return `[Test data from ${depNode.data.label}]`;
        });
        
        const combinedOutput = formatConcatenatedInputs(testInputs);
        useAgentStore.getState().setNodeOutput(outputNode.id, combinedOutput);
        
        const result = {
          nodeId: outputNode.id,
          output: combinedOutput,
          status: 'completed' as const
        };
        useAgentStore.getState().setExecutionResult(result);
      }
    });
    
    // Ensure the download button is enabled
    setOutputsAvailable(true);
    
    toast.success('Test outputs generated for all output nodes');
    // Update the state to indicate that outputs are available
    setTimeout(() => {
      // Check if any output nodes have outputs now
      const hasOutputs = storeNodes.some(node => 
        node.data.label === 'Output Box' && node.data.outputs && node.data.outputs.length > 0
      );
      
      if (hasOutputs) {
        console.log('Output nodes have data, enabling download button');
        setOutputsAvailable(true);
      }
    }, 100); // Short delay to ensure store updates are processed
  };

  // Helper function to format concatenated inputs
  const formatConcatenatedInputs = (inputs: string[]): string => {
    // Use the utility function from tokenManager
    return formatCombinedInputs(inputs);
  };

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
              onClick={testAllConnections}
              disabled={isRunning || storeNodes.length === 0}
              className="shadow-md hover:shadow-lg transition-all"
            >
              Test Connections
            </Button>
            <Button
              variant="outline"
              onClick={generateTestOutputs}
              disabled={isRunning || storeNodes.length === 0}
              className="shadow-md hover:shadow-lg transition-all"
            >
              Generate Test Data
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
              disabled={isRunning || !outputsAvailable}
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
