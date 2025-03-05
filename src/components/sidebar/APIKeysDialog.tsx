import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgentStore } from '@/store/agentStore';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CacheControls } from '@/components/settings/CacheControls';
import { Key, DatabaseZap } from 'lucide-react';

interface APIKeysDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function APIKeysDialog({ isOpen, onClose }: APIKeysDialogProps) {
  const apiKeys = useAgentStore((state) => state.apiKey);
  const setApiKey = useAgentStore((state) => state.setApiKey);
  
  const [openaiKey, setOpenaiKey] = React.useState(apiKeys.openai || '');
  const [perplexityKey, setPerplexityKey] = React.useState(apiKeys.perplexity || '');
  const [activeTab, setActiveTab] = React.useState('api-keys');
  
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
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your API keys and application settings
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="cache" className="flex items-center gap-2">
              <DatabaseZap className="h-4 w-4" />
              Cache
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="api-keys" className="mt-4">
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                  <Input
                    id="openai-api-key"
                    type="password"
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your key from <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">OpenAI</a>
                  </p>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="perplexity-api-key">Perplexity API Key</Label>
                  <Input
                    id="perplexity-api-key"
                    type="password"
                    placeholder="pplx-..."
                    value={perplexityKey}
                    onChange={(e) => setPerplexityKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your key from <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noreferrer" className="text-primary underline">Perplexity</a>
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button type="submit">Save API Keys</Button>
              </DialogFooter>
            </form>
          </TabsContent>
          
          <TabsContent value="cache" className="mt-4">
            <CacheControls />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
