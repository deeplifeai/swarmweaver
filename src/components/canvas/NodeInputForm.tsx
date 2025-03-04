import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';

interface NodeInputFormProps {
  onClose: () => void;
  onSubmit: (input: string) => void;
  nodeId: string;
  initialInput?: string;
}

export function NodeInputForm({ onClose, onSubmit, nodeId, initialInput = '' }: NodeInputFormProps) {
  const [input, setInput] = useState(initialInput);

  // Reset input when initialInput changes or component mounts
  useEffect(() => {
    setInput(initialInput);
  }, [initialInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (input.trim()) {
      onSubmit(input.trim());
    }
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('NodeInputForm handleClose called');
    onClose();
  };

  // Use a simpler modal approach instead of Dialog
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={handleClose}>
      <div 
        className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {initialInput ? 'Edit Input' : 'Add Input'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-sm text-gray-500 mb-4">
          {initialInput 
            ? 'Modify the existing input for this agent.'
            : 'Enter a prompt or input for this agent to process.'}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            id="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your prompt here..."
            className="min-h-40"
            autoFocus
          />
          
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!input.trim()}>
              {initialInput ? 'Update' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
