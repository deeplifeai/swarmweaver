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
    console.group('🧪 Generating test outputs for nodes');
    
    if (storeNodes.length === 0) {
      console.warn('⚠️ No nodes found in the canvas');
      console.groupEnd();
      toast.warning('No nodes found in the canvas');
      return;
    }
    
    // First identify multi-input nodes to highlight them in testing
    const nodeConnections = new Map<string, string[]>();
    
    // Build a map of node ID to array of source node IDs
    storeEdges.forEach(edge => {
      if (!nodeConnections.has(edge.target)) {
        nodeConnections.set(edge.target, []);
      }
      nodeConnections.get(edge.target)?.push(edge.source);
    });
    
    // Find agent nodes (not output nodes) with multiple inputs
    const multiInputAgents = storeNodes.filter(node => 
      node.data.label !== 'Output Box' && 
      nodeConnections.has(node.id) && 
      nodeConnections.get(node.id)!.length > 1
    );
    
    if (multiInputAgents.length > 0) {
      console.info(`🔍 Found ${multiInputAgents.length} agent nodes with multiple inputs:`);
      multiInputAgents.forEach(node => {
        const sources = nodeConnections.get(node.id) || [];
        console.info(`   - ${node.data.label} (${node.id}) has ${sources.length} input sources`);
      });
    } else {
      console.info('ℹ️ No agent nodes with multiple inputs found in the canvas');
    }
    
    // First pass: Generate mock outputs for all non-output nodes
    storeNodes.forEach(node => {
      // Skip nodes that already have outputs
      if (node.data.outputs && node.data.outputs.length > 0) {
        console.log(`ℹ️ Node ${node.id} (${node.data.label}) already has outputs - preserving existing data`);
        return;
      }
      
      // Skip output nodes - we'll handle them in a later pass
      if (node.data.label === 'Output Box') {
        return;
      }
      
      // Create a sample output based on node type with clear visual markers
      let sampleOutput = '';
      
      if (node.data.label === 'Input Box') {
        // For input nodes, include a distinctive marker in the output
        sampleOutput = `📥 INPUT FROM: ${node.data.label} (ID: ${node.id})\n\n` +
          `This is sample input text for testing data propagation through the canvas.\n\n` +
          `When you see this text in another node, it means the data successfully flowed ` +
          `from this input node to that node.\n\n` +
          `----------------\n` +
          `Node Type: Input Box\n` +
          `Node ID: ${node.id}\n` +
          `Unique marker: INPUT-${node.id.substring(0, 4)}`;
      } else {
        // For agent nodes, create mock output that's tailored to the agent's label
        let roleSpecificContent = '';
        
        // Generate content based on the agent's name/label
        const label = node.data.label.toLowerCase();
        if (label.includes('formulation') || label.includes('planner')) {
          roleSpecificContent = `Here is a plan I've formulated based on the input:\n\n` +
            `1. Analyze the requirements\n` +
            `2. Break down the problem into steps\n` +
            `3. Assign appropriate agents to each step\n` +
            `4. Monitor progress and adjust as needed`;
        } else if (label.includes('research') || label.includes('search')) {
          roleSpecificContent = `Here are my research findings:\n\n` +
            `- The topic has several key dimensions\n` +
            `- Recent developments include...\n` +
            `- Important considerations for next steps are...`;
        } else if (label.includes('code') || label.includes('dev') || label.includes('program')) {
          roleSpecificContent = `\`\`\`python\n` +
            `def process_data(input_text):\n` +
            `    # This is sample code output\n` +
            `    result = input_text.upper()\n` +
            `    return f"Processed: {result}"\n` +
            `\`\`\`\n\n` +
            `This function demonstrates basic text processing.`;
        } else if (label.includes('review') || label.includes('check') || label.includes('test')) {
          roleSpecificContent = `Review completed. Here are my observations:\n\n` +
            `✅ Structure looks good\n` +
            `⚠️ Some areas need improvement\n` +
            `❌ Found potential issues that need addressing`;
        } else {
          roleSpecificContent = `Here is my analysis of the provided information:\n\n` +
            `The key points are:\n` +
            `1. First important finding\n` +
            `2. Second critical observation\n` +
            `3. Recommendations for next steps`;
        }
        
        sampleOutput = `🤖 OUTPUT FROM: ${node.data.label} (ID: ${node.id})\n\n` +
          roleSpecificContent + `\n\n` +
          `----------------\n` +
          `Node Type: Agent\n` +
          `Node ID: ${node.id}\n` +
          `Unique marker: AGENT-${node.id.substring(0, 4)}\n` +
          `Timestamp: ${new Date().toISOString()}`;
      }
      
      console.log(`📝 Generated test output for ${node.data.label} (${node.id})`);
      
      // Update the node's outputs directly
      useAgentStore.getState().setNodeOutput(node.id, sampleOutput);
    });
    
    // Second pass: Process multi-input agent nodes to show concatenation
    if (multiInputAgents.length > 0) {
      console.log('🔀 Processing multi-input agent nodes...');
      
      multiInputAgents.forEach(agent => {
        // Get the sources that feed into this agent
        const sourceIds = nodeConnections.get(agent.id) || [];
        
        // Collect outputs from source nodes
        const sourceData = sourceIds.map(sourceId => {
          const sourceNode = storeNodes.find(n => n.id === sourceId);
          if (!sourceNode) return null;
          
          const sourceName = sourceNode.data.label;
          
          if (!sourceNode.data.outputs || sourceNode.data.outputs.length === 0) {
            return {
              nodeId: sourceId,
              nodeName: sourceName,
              output: null
            };
          }
          
          return {
            nodeId: sourceId,
            nodeName: sourceName,
            output: sourceNode.data.outputs[sourceNode.data.outputs.length - 1]
          };
        }).filter(Boolean);
        
        // Count how many sources have outputs
        const sourcesWithOutputs = sourceData.filter(src => src && src.output).length;
        
        if (sourcesWithOutputs === 0) {
          console.warn(`⚠️ Agent ${agent.id} has ${sourceIds.length} inputs, but none have outputs yet`);
          return;
        }
        
        // Generate a special marker to show this is a multi-input test
        const headerText = `🔀 MULTI-INPUT AGENT TEST: ${agent.data.label} (ID: ${agent.id})\n\n` +
          `This agent receives inputs from ${sourcesWithOutputs} of ${sourceIds.length} source nodes.\n\n` +
          `During normal canvas execution, these inputs would be CONCATENATED before being sent to this agent.\n` +
          `The concatenated input would look like this:\n\n` +
          `=============================================================\n\n`;
        
        // Collect the source outputs that would be concatenated
        const sourceOutputs = sourceData
          .filter(src => src && src.output)
          .map(src => src.output);
        
        if (sourceOutputs.length > 0) {
          // Format using our concatenation function
          const concatenatedPreview = formatConcatenatedInputs(sourceOutputs);
          
          // Create a special output showing what this agent will receive as input when run
          const previewOutput = headerText + concatenatedPreview + 
            `\n\n=============================================================\n\n` +
            `This preview helps you verify that multiple inputs are correctly concatenated.\n` +
            `When you run the canvas, this agent will receive all inputs combined as shown above.\n\n` +
            `Look for the unique markers from each input source to confirm proper data flow.`;
          
          // Override the previously generated output to show the multi-input test
          console.log(`🔀 Created multi-input test preview for ${agent.data.label} (${agent.id})`);
          useAgentStore.getState().setNodeOutput(agent.id, previewOutput);
        }
      });
    }
    
    // Third pass: Process output nodes to collect from dependencies
    const outputNodes = storeNodes.filter(node => node.data.label === 'Output Box');
    if (outputNodes.length > 0) {
      console.log('📦 Processing output nodes to collect inputs from dependencies...');
      
      outputNodes.forEach(outputNode => {
        const dependencies = getNodeDependencies(outputNode.id);
        if (dependencies.length === 0) {
          console.log(`⚠️ Output node ${outputNode.id} has no dependencies, skipping`);
          
          // Create a warning message for output nodes with no dependencies
          const warningOutput = `⚠️ OUTPUT NODE WARNING (ID: ${outputNode.id})\n\n` +
            `This output node doesn't have any incoming connections.\n` +
            `To see data flow, connect this node to an input or agent node, then run the test again.`;
          
          useAgentStore.getState().setNodeOutput(outputNode.id, warningOutput);
          return;
        }
        
        // Collect outputs from dependencies
        const dependencyData = dependencies.map(depId => {
          const depNode = storeNodes.find(n => n.id === depId);
          if (!depNode) return null;
          
          const depName = depNode.data.label;
          
          if (!depNode.data.outputs || depNode.data.outputs.length === 0) {
            return {
              nodeId: depId,
              nodeName: depName,
              output: null
            };
          }
          
          return {
            nodeId: depId,
            nodeName: depName,
            output: depNode.data.outputs[depNode.data.outputs.length - 1]
          };
        }).filter(Boolean);
        
        // Count how many dependencies have outputs
        const depsWithOutputs = dependencyData.filter(dep => dep && dep.output).length;
        const totalDeps = dependencyData.length;
        
        if (depsWithOutputs === 0) {
          console.warn(`⚠️ Output node ${outputNode.id} has ${totalDeps} dependencies, but none have outputs`);
          
          // Create a warning message
          const warningOutput = `⚠️ OUTPUT NODE WARNING (ID: ${outputNode.id})\n\n` +
            `This output node has ${totalDeps} incoming connection${totalDeps > 1 ? 's' : ''}, but ` +
            `none of them have generated any output yet.\n\n` +
            `Connected nodes:\n` + 
            dependencyData.map(dep => `- ${dep.nodeName} (ID: ${dep.nodeId})`).join('\n');
          
          useAgentStore.getState().setNodeOutput(outputNode.id, warningOutput);
          return;
        }
        
        // Format the concatenated output with clear markers showing the source of each part
        const headerText = `📋 CONCATENATED OUTPUT (ID: ${outputNode.id})\n\n` +
          `This output node has collected data from ${depsWithOutputs} of ${totalDeps} connected node${totalDeps > 1 ? 's' : ''}.\n\n` +
          `=============================================================\n\n`;
        
        const depOutputs = dependencyData
          .filter(dep => dep && dep.output)
          .map(dep => dep.output);
        
        if (depOutputs.length > 0) {
          const combinedOutput = headerText + formatConcatenatedInputs(depOutputs);
          console.log(`📦 Setting output for node ${outputNode.id} based on ${depOutputs.length} dependency outputs`);
          useAgentStore.getState().setNodeOutput(outputNode.id, combinedOutput);
        }
      });
    }
    
    console.log('✅ All nodes updated with test outputs');
    console.groupEnd();
    toast.success('Test outputs generated! You can now visually trace data flow through the canvas.');
    
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
    if (inputs.length === 0) return '';
    if (inputs.length === 1) return inputs[0];
    
    // Join inputs with clear separators
    return inputs
      .filter(input => input && input.trim()) // Filter out empty inputs
      .map((input, index) => {
        // Add a header for each input if there are multiple
        return `--- INPUT ${index + 1} ---\n${input}\n`;
      })
      .join('\n');
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
