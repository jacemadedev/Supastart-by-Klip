'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ApprovalRequest {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  agent: string;
  timestamp: number;
}

interface ApprovalMessageProps {
  approvalRequests: ApprovalRequest[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
}

const getToolIcon = (toolName: string) => {
  switch (toolName) {
    case 'web_search':
      return <Search className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getToolDescription = (toolName: string, args: Record<string, unknown>) => {
  switch (toolName) {
    case 'web_search':
      return {
        title: 'Web Search',
        description: `"${args.query}"`,
        reason: args.reason as string || 'To provide current information',
        type: 'search'
      };
    default:
      return {
        title: 'Tool Execution',
        description: toolName,
        reason: 'Agent wants to use this tool',
        type: 'tool'
      };
  }
};

export default function ApprovalMessage({ 
  approvalRequests, 
  onApprove, 
  onReject, 
  onApproveAll, 
  onRejectAll 
}: ApprovalMessageProps) {
  // Move hooks outside conditional logic
  const handleApprove = React.useCallback((requestId: string) => {
    onApprove(requestId);
  }, [onApprove]);

  const handleReject = React.useCallback((requestId: string) => {
    onReject(requestId);
  }, [onReject]);

  const handleApproveAll = React.useCallback(() => {
    onApproveAll();
  }, [onApproveAll]);

  const handleRejectAll = React.useCallback(() => {
    onRejectAll();
  }, [onRejectAll]);

  if (approvalRequests.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 mb-4">
      <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
        <Clock className="h-4 w-4 text-amber-600" />
      </div>
      
      <div className="flex-1 space-y-3">
        <div className="text-sm text-muted-foreground">
          I need your permission to proceed with the following actions:
        </div>
        
        {approvalRequests.map((request) => {
          const toolInfo = getToolDescription(request.toolName, request.arguments);
          
          return (
            <Card key={request.id} className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getToolIcon(request.toolName)}
                    <CardTitle className="text-base">{toolInfo.title}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {request.agent}
                  </Badge>
                </div>
                <CardDescription className="text-sm">
                  Search for: {toolInfo.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="bg-muted/30 p-3 rounded-md mb-3">
                  <p className="text-sm">
                    <strong>Reason:</strong> {toolInfo.reason}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(request.id)}
                    className="flex items-center gap-1"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(request.id)}
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {approvalRequests.length > 1 && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRejectAll}
              className="flex items-center gap-1"
            >
              <XCircle className="h-4 w-4" />
              Reject All
            </Button>
            <Button
              size="sm"
              onClick={handleApproveAll}
              className="flex items-center gap-1"
            >
              <CheckCircle className="h-4 w-4" />
              Approve All
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 