
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { useAgentStore } from '@/store/agentStore';
import { NodeInputForm } from './NodeInputForm';
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

interface AgentNodeProps {
  id: string;
  data: {
    label: string;
    agentId?: string;
    inputs: string[];
    outputs: string[];
    color?: string;
  };
  isConnectable: boolean;
}

export function AgentNode({ id, data, isConnectable }: AgentNodeProps) {
  const [isInputFormOpen, setIsInputFormOpen] = React.useState(false);
  const executionResults = useAgentStore((state) => state.executionResults[id]);
  const agents = useAgentStore((state) => state.agents);
  
  const agent = data.agentId ? agents.find(a => a.id === data.agentId) : null;
  const backgroundColor = data.color || agent?.color || 'white';
  
  const handleSubmit = (input: string) => {
    useAgentStore.getState().addNodeInput(id, input);
    setIsInputFormOpen(false);
  };

  return (
    <div 
      className={cn(
        "agent-node group transition-all",
        data.label === "Output Box" && "output-node",
        executionResults?.status === 'running' && "animate-pulse-light"
      )}
      style={{ 
        borderTop: `4px solid ${backgroundColor}`,
        opacity: executionResults?.status === 'completed' ? 1 : 0.9
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="transition-all duration-300 opacity-0 group-hover:opacity-100"
      />
      
      <div className="agent-node-header flex justify-between items-center">
        <div className="font-medium truncate flex-1">{data.label}</div>
        {executionResults?.status && (
          <Badge variant={
            executionResults.status === 'completed' ? 'default' : 
            executionResults.status === 'running' ? 'secondary' : 
            executionResults.status === 'error' ? 'destructive' : 'outline'
          } className="ml-2 text-xs">
            {executionResults.status}
          </Badge>
        )}
      </div>
      
      <div className="text-xs text-gray-500 mt-2">
        {data.inputs.length > 0 && (
          <div className="mb-1">
            <div className="font-medium mb-1">Inputs: {data.inputs.length}</div>
            <div className="max-h-20 overflow-y-auto text-xs opacity-70">
              {data.inputs.slice(-1)[0]?.substring(0, 50)}
              {data.inputs.slice(-1)[0]?.length > 50 ? '...' : ''}
            </div>
          </div>
        )}
        
        {data.outputs.length > 0 && (
          <div>
            <div className="font-medium mb-1">Output:</div>
            <div className="max-h-20 overflow-y-auto text-xs opacity-70">
              {data.outputs.slice(-1)[0]?.substring(0, 50)}
              {data.outputs.slice(-1)[0]?.length > 50 ? '...' : ''}
            </div>
          </div>
        )}
        
        {data.inputs.length === 0 && data.outputs.length === 0 && (
          <div className="text-center py-2 opacity-50 italic">
            Click to add input
          </div>
        )}
      </div>
      
      <div 
        className="mt-2 text-primary text-xs cursor-pointer hover:underline text-center"
        onClick={() => setIsInputFormOpen(true)}
      >
        Add Input
      </div>
      
      {isInputFormOpen && (
        <NodeInputForm
          onClose={() => setIsInputFormOpen(false)}
          onSubmit={handleSubmit}
          nodeId={id}
        />
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable && data.label !== "Output Box"}
        className={cn(
          "transition-all duration-300 opacity-0 group-hover:opacity-100",
          data.label === "Output Box" && "hidden"
        )}
      />
    </div>
  );
}
