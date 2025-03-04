import React from 'react';
import { cn } from '@/lib/utils';
import { X, Edit } from 'lucide-react';
import { useAgentStore } from '@/store/agentStore';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AgentConfigDialog } from './AgentConfigDialog';

interface DraggableAgentItemProps {
  label: string;
  color: string;
  isCollapsed: boolean;
  data: any;
  agentId?: string;
  isUserDefined?: boolean;
}

export function DraggableAgentItem({ 
  label, 
  color, 
  isCollapsed, 
  data, 
  agentId,
  isUserDefined = false 
}: DraggableAgentItemProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = React.useState(false);
  const removeAgent = useAgentStore((state) => state.removeAgent);

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', 'agent');
    event.dataTransfer.setData('application/reactflow/data', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isUserDefined && agentId) {
      setIsDeleteDialogOpen(true);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isUserDefined && agentId) {
      setIsAgentDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    if (agentId) {
      removeAgent(agentId);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        className={cn(
          "p-3 bg-white rounded-lg border border-gray-200 shadow-sm cursor-grab transition-all duration-200 relative",
          "hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 active:shadow-sm active:translate-y-0",
          isCollapsed ? "w-10 h-10 flex items-center justify-center" : "w-full"
        )}
        style={{
          borderLeft: `4px solid ${color}`
        }}
      >
        {isUserDefined && !isCollapsed && (
          <div className="absolute top-2 right-2 flex space-x-1">
            <button
              className="h-5 w-5 bg-gray-100 rounded-full text-gray-600 flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-all"
              onClick={handleEdit}
              title="Edit agent"
            >
              <Edit className="h-3 w-3" />
            </button>
            <button
              className="h-5 w-5 bg-gray-100 rounded-full text-gray-600 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-all"
              onClick={handleDelete}
              title="Delete agent"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {isCollapsed ? (
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: color }}
          />
        ) : (
          <div className="flex items-center">
            <div 
              className="w-3 h-3 rounded-full mr-2" 
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-medium truncate">{label}</span>
          </div>
        )}
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Are you sure you want to delete the agent <span className="font-medium">{label}</span>? This action cannot be undone.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAgentDialogOpen && (
        <AgentConfigDialog 
          isOpen={isAgentDialogOpen}
          onClose={() => setIsAgentDialogOpen(false)}
          agentId={agentId}
        />
      )}
    </>
  );
}
