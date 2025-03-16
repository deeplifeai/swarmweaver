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
import { useAgentState } from '@/store/useAgentState.tsx';
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

  const {
    nodes: storeNodes,
    edges: storeEdges,
    agents,
    executionResults,
    saveCanvasState,
    exportCanvasToFile,
    clearCanvas,
    clearAgents,
    addEdge: addFlowEdge,
    removeEdge,
    updateNode,
    removeNode,
    setExecutionResult,
    setNodeOutput,
    processingApiCalls,
    setProcessingApiCalls,
    apiKey: apiKeys
  } = useAgentState();

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
      addFlowEdge({
        source: connection.source as string,
        target: connection.target as string,
        animated: true,
        style: { stroke: '#555' },
      });
    },
    [addFlowEdge]
  );

  const onEdgeDelete = useCallback(
    (edge: Edge) => {
      console.info('onEdgeDelete called with edge:', edge);
      removeEdge(edge.id);
    },
    [removeEdge]
  );

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: any) => {
      console.info('onNodeDragStop triggered for node:', node);
      updateNode(node.id, {
        position: node.position,
      });
    },
    [updateNode]
  );

  const onNodeDelete = useCallback(
    (event: React.MouseEvent, node: any) => {
      console.info('onNodeDelete triggered for node:', node);
      removeNode(node.id);
    },
    [removeNode]
  );

  const onNodesDelete = useCallback(
    (nodes: any[]) => {
      console.info('onNodesDelete triggered for nodes:', nodes.map(n => n.id));
      nodes.forEach(node => {
        removeNode(node.id);
      });
    },
    [removeNode]
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

  const processNode = async (nodeId: string, processedNodes: Set<string>, processingNodes?: Set<string>, depth: number = 0): Promise<AgentExecutionResult> => {
    const MAX_DEPTH = 100;
    if (depth > MAX_DEPTH) {
      const errorMsg = `Maximum recursion depth (${MAX_DEPTH}) exceeded`;
      console.error(`Error: ${errorMsg} at node ${nodeId}`);
      setExecutionResult({
        nodeId,
        output: `[Error: ${errorMsg}]`,
        status: 'error',
        error: errorMsg
      });
      toast.error(`Error in node "${nodeId}": ${errorMsg}`);
      return {
        nodeId,
        output: `[Error: ${errorMsg}]`,
        status: 'error',
        error: errorMsg
      };
    }

    processingNodes = processingNodes || new Set<string>();

    if (processingNodes.has(nodeId)) {
      const errorMsg = 'Circular dependency detected';
      console.error(`Cycle detected: Node ${nodeId} is already being processed. Aborting to prevent infinite recursion.`);
      setExecutionResult({
        nodeId,
        output: `[Error: ${errorMsg}]`,
        status: 'error',
        error: errorMsg
      });
      toast.error(`Error in node "${nodeId}": ${errorMsg}`);
      return {
        nodeId,
        output: `[Error: ${errorMsg}]`,
        status: 'error',
        error: errorMsg
      };
    }

    processingNodes.add(nodeId);

    console.info(`Starting processing for node ${nodeId} at depth ${depth}`);

    if (processedNodes.has(nodeId)) {
      const cachedResult = executionResults[nodeId];
      if (cachedResult) {
        console.info(`Node ${nodeId} already processed. Returning cached result.`);
        processingNodes.delete(nodeId);
        return cachedResult;
      }
    }

    const node = storeNodes.find(n => n.id === nodeId);
    if (!node) {
      const errorMsg = 'Node not found';
      console.error(`Error: ${errorMsg} for node ${nodeId}`);
      processingNodes.delete(nodeId);
      return {
        nodeId,
        output: '',
        status: 'error',
        error: errorMsg
      };
    }

    setExecutionResult({
      nodeId,
      output: '',
      status: 'running'
    });

    try {
      const dependencies = getNodeDependencies(nodeId);
      console.info(`Node ${nodeId} dependencies:`, dependencies);
      const dependencyResults: AgentExecutionResult[] = [];
      for (const depId of dependencies) {
        const depResult = await processNode(depId, processedNodes, processingNodes, depth + 1);
        dependencyResults.push(depResult);
        if (depResult.status === 'error') {
          break;
        }
      }

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

        const systemPrompt = agent.systemPrompt || '';
        const effectiveSystemPrompt = systemPrompt.trim().length === 0 ?
          'You are a helpful AI assistant. Respond to the user input below in a clear and concise manner.' :
          systemPrompt;

        const combinedInput = formatCombinedInputs([
          ...node.data.inputs,
          ...dependencyOutputs
        ]);

        if (!combinedInput) {
          throw new Error('No input provided for agent');
        }
        console.info(`Combined input for node ${nodeId} (length: ${combinedInput.length}): ${combinedInput.substring(0, 50)}...`);

        console.info(`Generating agent response for node ${nodeId}`);
        try {
          // Keep track of nodes currently being processed with API calls to prevent race conditions
          const currentlyProcessing = processingApiCalls || {};
          
          // Check if this exact node is already being processed
          if (currentlyProcessing[nodeId]) {
            console.warn(`Node ${nodeId} is already processing an API call, waiting for that to complete...`);
            output = await currentlyProcessing[nodeId];
          } else {
            // Create a new promise for this node's API call
            const apiPromise = (async () => {
              try {
                let result;
                if (combinedInput.length > 10000) {
                  console.info(`Node ${nodeId} has large input (${combinedInput.length} chars), using optimized processing`);
                  const apiKey = apiKeys[agent.provider];
                  result = await processWithChunkedStrategy(
                    agent.provider,
                    agent.model,
                    effectiveSystemPrompt,
                    combinedInput,
                    apiKey
                  );
                } else {
                  result = await generateAgentResponse(
                    agent.provider,
                    agent.model,
                    effectiveSystemPrompt,
                    combinedInput
                  );
                }
                return result;
              } finally {
                // Cleanup: remove this promise when done
                const updatedProcessing = processingApiCalls || {};
                delete updatedProcessing[nodeId];
                setProcessingApiCalls(updatedProcessing);
              }
            })();
            
            // Store the promise in the store
            const updatedProcessing = {...currentlyProcessing};
            updatedProcessing[nodeId] = apiPromise;
            setProcessingApiCalls(updatedProcessing);
            
            // Wait for the API call to complete
            output = await apiPromise;
          }

          if (output.startsWith('[Error:')) {
            throw new Error(output.substring(8, output.length - 1));
          }
          if (output.startsWith('[ERROR::')) {
            const errorMessage = output.substring(8, output.length - 1);
            console.error(`Error detected in agent response: ${errorMessage}`);
            throw new Error(errorMessage);
          }
          console.info(`Agent response received for node ${nodeId}`);
        } catch (apiError) {
          console.error(`API error for node ${nodeId}:`, apiError);
          throw new Error(`API error: ${apiError.message || 'Unknown API error'}`);
        }
      }

      if (!output || output.trim().length === 0) {
        console.warn(`Empty output returned for node ${nodeId} without error`);
        output = "[Warning: Empty response received from the API]";
        const result = {
          nodeId,
          output,
          status: 'error' as const,
          error: 'Empty response received from the API'
        };
        setExecutionResult(result);
        console.info(`Node ${nodeId} processed with error: Empty response`);
        processingNodes.delete(nodeId);
        return result;
      }

      setNodeOutput(nodeId, output);
      processedNodes.add(nodeId);
      const result = {
        nodeId,
        output,
        status: 'completed' as const
      };
      setExecutionResult(result);
      console.info(`Node ${nodeId} processed successfully`);
      processingNodes.delete(nodeId);
      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error(`Error processing node ${nodeId}:`, error);
      const errorOutput = `[Error: ${errorMessage}]`;
      setNodeOutput(nodeId, errorOutput);
      const result = {
        nodeId,
        output: errorOutput,
        status: 'error' as const,
        error: errorMessage
      };
      setExecutionResult(result);
      toast.error(`Error in node "${node.data.label}": ${errorMessage}`);
      processingNodes.delete(nodeId);
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

      addFlowEdge({
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
    [reactFlowWrapper, addFlowEdge]
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
        setNodeOutput(outputNode.id, warningOutput);
        
        const result = {
          nodeId: outputNode.id,
          output: warningOutput,
          status: 'completed' as const
        };
        setExecutionResult(result);
      } else {
        // Create combined test output from all upstream nodes
        const testInputs = dependencies.map(depId => {
          const depNode = storeNodes.find(n => n.id === depId);
          if (!depNode) return `[Test data from unknown node]`;
          return `[Test data from ${depNode.data.label}]`;
        });
        
        const combinedOutput = formatCombinedInputs(testInputs);
        setNodeOutput(outputNode.id, combinedOutput);
        
        const result = {
          nodeId: outputNode.id,
          output: combinedOutput,
          status: 'completed' as const
        };
        setExecutionResult(result);
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
                  addFlowEdge({
                    type: 'agent',
                    position: selectedNode.position,
                    data: {
                      ...selectedNode.data,
                      inputs: [],
                      outputs: []
                    }
                  });
                  toast.success('Agent saved to canvas');
                } else {
                  toast.error('Please select an agent node first');
                }
              }}
              className="shadow-md hover:shadow-lg transition-all"
            >
              Save Agent to Canvas
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
