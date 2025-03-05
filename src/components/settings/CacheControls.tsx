import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAgentStore } from '@/store/agentStore';
import { DatabaseZap, Trash2 } from 'lucide-react';

export function CacheControls() {
  const { cacheStats, clearResponseCache, toggleCacheEnabled, updateCacheStats } = useAgentStore();

  // Update cache stats periodically
  useEffect(() => {
    updateCacheStats();
    const interval = setInterval(updateCacheStats, 5000);
    return () => clearInterval(interval);
  }, [updateCacheStats]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseZap className="h-5 w-5" />
          Response Cache
        </CardTitle>
        <CardDescription>
          Optimize performance by caching API responses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="cache-enabled">Cache Enabled</Label>
            <Switch 
              id="cache-enabled" 
              checked={cacheStats.enabled}
              onCheckedChange={toggleCacheEnabled}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Cache Size</Label>
            <span className="text-sm font-medium">
              {cacheStats.size} {cacheStats.size === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          variant="destructive" 
          className="w-full"
          onClick={clearResponseCache}
          disabled={cacheStats.size === 0}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Cache
        </Button>
      </CardFooter>
    </Card>
  );
} 