'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TruncateTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string | null | undefined;
  maxLength?: number;
}

export function TruncateText({ text, maxLength = 25, className, ...props }: TruncateTextProps) {
  if (!text) return <span className="text-muted-foreground">-</span>;

  if (text.length <= maxLength) {
    return (
      <div className={cn('truncate', className)} {...props}>
        {text}
      </div>
    );
  }

  const truncated = text.substring(0, maxLength) + '...';

  return (
    <Popover>
      <PopoverTrigger 
        className={cn('cursor-pointer hover:underline text-foreground/80 hover:text-foreground transition-colors bg-transparent border-0 p-0 m-0 text-left w-full truncate inline-block appearance-none outline-none font-inherit text-inherit', className)} 
        {...(props as any)}
      >
        {truncated}
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[90vw] sm:max-w-md break-words p-3 text-sm z-[100]" side="top" align="start">
        {text}
      </PopoverContent>
    </Popover>
  );
}
