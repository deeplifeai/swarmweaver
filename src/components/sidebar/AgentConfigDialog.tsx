
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAgentStore } from '@/store/agentStore';
import { toast } from 'sonner';
import { AIProvider, AIModel } from '@/types/agent';

interface AgentConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
}

// Predefined colors
const agentColors = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // yellow
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function AgentConfigDialog({ isOpen, onClose, agentId }: AgentConfigDialogProps) {
  const addAgent = useAgentStore((state) => state.addAgent);
  const updateAgent = useAgentStore((state) => state.updateAgent);
  const agents = useAgentStore((state) => state.agents);
  
  const existingAgent = agentId ? agents.find(a => a.id === agentId) : undefined;
  
  const [name, setName] = React.useState(existingAgent?.name || '');
  const [systemPrompt, setSystemPrompt] = React.useState(existingAgent?.systemPrompt || '');
  const [provider, setProvider] = React.useState<AIProvider>(existingAgent?.provider || 'openai');
  const [model, setModel] = React.useState<AIModel>(existingAgent?.model || 'gpt-4o-mini');
  const [color, setColor] = React.useState(existingAgent?.color || agentColors[0]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Agent name is required');
      return;
    }
    
    if (!systemPrompt.trim()) {
      toast.error('System prompt is required');
      return;
    }
    
    if (existingAgent) {
      updateAgent(existingAgent.id, {
        name,
        systemPrompt,
        provider,
        model,
        color
      });
      toast.success(`Agent "${name}" updated`);
    } else {
      addAgent({
        name,
        systemPrompt,
        provider,
        model,
        color
      });
      toast.success(`Agent "${name}" created`);
    }
    
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg glass-panel animate-scale-in">
        <DialogHeader>
          <DialogTitle>
            {existingAgent ? 'Edit Agent' : 'Create New Agent'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Research Assistant"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Agent Color</Label>
                <div className="grid grid-cols-8 gap-2">
                  {agentColors.map((c) => (
                    <div
                      key={c}
                      className={`w-8 h-8 rounded-md cursor-pointer transition-all ${
                        color === c ? 'ring-2 ring-primary ring-offset-2' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Describe the agent's role and instructions"
                className="h-32"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">AI Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(value) => setProvider(value as AIProvider)}
                >
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="perplexity">Perplexity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <Select
                  value={model}
                  onValueChange={(value) => setModel(value as AIModel)}
                >
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {provider === 'openai' ? (
                      <>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="llama-3.1-sonar-small-128k-online">Llama 3.1 Sonar Small</SelectItem>
                        <SelectItem value="llama-3.1-sonar-large-128k-online">Llama 3.1 Sonar Large</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {existingAgent ? 'Update Agent' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
