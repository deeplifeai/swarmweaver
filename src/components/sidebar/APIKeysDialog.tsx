
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgentStore } from '@/store/agentStore';
import { toast } from 'sonner';

interface APIKeysDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function APIKeysDialog({ isOpen, onClose }: APIKeysDialogProps) {
  const apiKeys = useAgentStore((state) => state.apiKey);
  const setApiKey = useAgentStore((state) => state.setApiKey);
  
  const [openaiKey, setOpenaiKey] = React.useState(apiKeys.openai || '');
  const [perplexityKey, setPerplexityKey] = React.useState(apiKeys.perplexity || '');
  
  // Update local state when store changes or dialog opens
  useEffect(() => {
    setOpenaiKey(apiKeys.openai || '');
    setPerplexityKey(apiKeys.perplexity || '');
  }, [apiKeys, isOpen]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    setApiKey('openai', openaiKey.trim());
    setApiKey('perplexity', perplexityKey.trim());
    
    toast.success('API keys saved');
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md glass-panel animate-scale-in">
        <DialogHeader>
          <DialogTitle>Configure API Keys</DialogTitle>
          <DialogDescription>
            Your API keys are stored securely in your browser's local storage and will persist between sessions.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai">OpenAI API Key</Label>
            <Input
              id="openai"
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">
              Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">OpenAI</a>
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="perplexity">Perplexity API Key</Label>
            <Input
              id="perplexity"
              type="password"
              value={perplexityKey}
              onChange={(e) => setPerplexityKey(e.target.value)}
              placeholder="pplx-..."
            />
            <p className="text-xs text-muted-foreground">
              Get your key from <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noreferrer" className="text-primary underline">Perplexity</a>
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Keys</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
