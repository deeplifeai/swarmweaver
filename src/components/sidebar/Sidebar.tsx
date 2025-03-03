
import React from 'react';
import { useAgentStore } from '@/store/agentStore';
import { Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DraggableAgentItem } from './DraggableAgentItem';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { AgentConfigDialog } from './AgentConfigDialog';
import { APIKeysDialog } from './APIKeysDialog';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = React.useState(false);
  const [isKeysDialogOpen, setIsKeysDialogOpen] = React.useState(false);
  
  const agents = useAgentStore((state) => state.agents);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div 
      className={cn(
        "h-full bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shadow-md",
        isCollapsed ? "w-16" : "w-72"
      )}
    >
      <div className="p-4 flex items-center justify-between border-b">
        <h2 className={cn("font-semibold", isCollapsed && "hidden")}>Agent Library</h2>
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
          {isCollapsed ? "→" : "←"}
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className={cn("space-y-4", isCollapsed && "items-center justify-center flex flex-col")}>
          {!isCollapsed && (
            <div className="text-sm text-gray-500 mb-2">
              Drag agents to the canvas
            </div>
          )}
          
          {/* Predefined Output Box */}
          <DraggableAgentItem
            label="Output Box"
            color="#3b82f6"
            isCollapsed={isCollapsed}
            data={{
              label: "Output Box",
              inputs: [],
              outputs: []
            }}
          />
          
          <Separator className={cn("my-4", isCollapsed && "w-8")} />
          
          {/* User-defined agents */}
          {agents.map((agent) => (
            <DraggableAgentItem
              key={agent.id}
              label={agent.name}
              color={agent.color}
              isCollapsed={isCollapsed}
              data={{
                label: agent.name,
                agentId: agent.id,
                inputs: [],
                outputs: [],
                color: agent.color
              }}
            />
          ))}
          
          {agents.length === 0 && !isCollapsed && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No agents created yet
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className={cn(
        "border-t p-4",
        isCollapsed ? "flex justify-center" : "space-y-2"
      )}>
        {!isCollapsed && (
          <Button 
            variant="outline" 
            className="w-full justify-start" 
            onClick={() => setIsKeysDialogOpen(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            API Keys
          </Button>
        )}
        
        <Button 
          className={cn("", isCollapsed && "h-8 w-8 p-0")}
          onClick={() => setIsAgentDialogOpen(true)}
        >
          <Plus className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
          {!isCollapsed && "Create Agent"}
        </Button>
      </div>
      
      <AgentConfigDialog 
        isOpen={isAgentDialogOpen}
        onClose={() => setIsAgentDialogOpen(false)}
      />
      
      <APIKeysDialog
        isOpen={isKeysDialogOpen}
        onClose={() => setIsKeysDialogOpen(false)} 
      />
    </div>
  );
}
