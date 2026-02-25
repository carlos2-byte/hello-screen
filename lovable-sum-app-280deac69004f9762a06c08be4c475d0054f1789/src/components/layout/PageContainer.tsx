import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  noPadding?: boolean;
}

export function PageContainer({ 
  children, 
  className,
  header,
  noPadding = false,
}: PageContainerProps) {
  return (
    <div className={cn(
      'min-h-screen min-h-dvh w-full pb-20 safe-top',
      !noPadding && 'px-4 pt-6',
      className
    )}>
      {header && (
        <header className="mb-6 max-w-lg mx-auto">
          {header}
        </header>
      )}
      <main className="mx-auto max-w-lg w-full">
        {children}
      </main>
    </div>
  );
}
