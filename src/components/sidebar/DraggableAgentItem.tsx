
import React from 'react';
import { cn } from '@/lib/utils';

interface DraggableAgentItemProps {
  label: string;
  color: string;
  isCollapsed: boolean;
  data: any;
}

export function DraggableAgentItem({ label, color, isCollapsed, data }: DraggableAgentItemProps) {
  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', 'agent');
    event.dataTransfer.setData('application/reactflow/data', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        "p-3 bg-white rounded-lg border border-gray-200 shadow-sm cursor-grab transition-all duration-200",
        "hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 active:shadow-sm active:translate-y-0",
        isCollapsed ? "w-10 h-10 flex items-center justify-center" : "w-full"
      )}
      style={{
        borderLeft: `4px solid ${color}`
      }}
    >
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
  );
}
