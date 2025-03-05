import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { useAgentStore } from '@/store/agentStore';
import { NodeInputForm } from './NodeInputForm';
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { AgentConfigDialog } from '@/components/sidebar/AgentConfigDialog';

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
  const [isAgentDialogOpen, setIsAgentDialogOpen] = React.useState(false);
  const executionResults = useAgentStore((state) => state.executionResults[id]);
  const agents = useAgentStore((state) => state.agents);
  const removeNode = useAgentStore((state) => state.removeNode);
  
  // Debug state changes
  React.useEffect(() => {
    console.log(`AgentNode ${id} isInputFormOpen:`, isInputFormOpen);
  }, [isInputFormOpen, id]);
  
  // Handle cleanup on unmount
  React.useEffect(() => {
    return () => {
      console.log(`AgentNode ${id} unmounted`);
    };
  }, [id]);
  
  const agent = data.agentId ? agents.find(a => a.id === data.agentId) : null;
  const backgroundColor = data.color || agent?.color || 'white';
  
  const handleSubmit = (input: string) => {
    console.log('handleSubmit called with:', input);
    useAgentStore.getState().addNodeInput(id, input);
    setIsInputFormOpen(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    console.log('handleEditClick called');
    e.preventDefault();
    e.stopPropagation();
    setIsInputFormOpen(true);
  };

  const handleRemoveNode = (e: React.MouseEvent) => {
    console.log('handleRemoveNode called');
    e.preventDefault();
    e.stopPropagation();
    removeNode(id);
  };

  const closeInputForm = () => {
    console.log('closeInputForm called');
    setIsInputFormOpen(false);
  };

  return (
    <div 
      className={cn(
        "agent-node group transition-all relative",
        data.label === "Output Box" && "output-node",
        executionResults?.status === 'running' && "animate-pulse-light"
      )}
      style={{ 
        borderTop: `4px solid ${backgroundColor}`,
        opacity: executionResults?.status === 'completed' ? 1 : 0.9
      }}
      onClick={data.label !== "Output Box" ? handleEditClick : undefined}
    >
      {/* Remove button */}
      <button 
        className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={handleRemoveNode}
      >
        <X className="h-3 w-3" />
      </button>

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
            {data.label !== "Output Box" ? "Click to add input" : "Output will appear here"}
          </div>
        )}
      </div>
      
      {/* Only show Add/Edit Input button for non-Output Box nodes */}
      {data.label !== "Output Box" && (
        <div 
          className="mt-2 text-primary text-xs cursor-pointer hover:underline text-center"
          onClick={(e) => {
            console.log('Add/Edit Input button clicked');
            e.preventDefault();
            e.stopPropagation();
            setIsInputFormOpen(true);
          }}
        >
          {data.inputs.length > 0 ? 'Edit Input' : 'Add Input'}
        </div>
      )}
      
      {/* Render NodeInputForm in a Portal to avoid parent component issues */}
      {isInputFormOpen && (
        <NodeInputForm
          onClose={closeInputForm}
          onSubmit={handleSubmit}
          nodeId={id}
          initialInput={data.inputs.length > 0 ? data.inputs[0] : ''}
        />
      )}

      {isAgentDialogOpen && (
        <AgentConfigDialog 
          isOpen={isAgentDialogOpen}
          onClose={() => setIsAgentDialogOpen(false)}
          agentId={data.agentId}
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
