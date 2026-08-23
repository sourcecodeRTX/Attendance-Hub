'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Button } from './button';

export interface PasswordInputProps
  extends Omit<React.ComponentProps<'input'>, 'type'> {
  showStrengthMeter?: boolean;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrengthMeter = false, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [strength, setStrength] = React.useState(0);
    const [password, setPassword] = React.useState('');

    const calculateStrength = React.useCallback((pwd: string) => {
      if (!pwd) return 0;
      let score = 0;
      
      // Length checks
      if (pwd.length >= 8) score += 1;
      if (pwd.length >= 12) score += 1;
      if (pwd.length >= 16) score += 1;
      
      // Character variety
      if (/[a-z]/.test(pwd)) score += 1;
      if (/[A-Z]/.test(pwd)) score += 1;
      if (/[0-9]/.test(pwd)) score += 1;
      if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;
      
      // Penalize common patterns
      if (/^[a-zA-Z]+$/.test(pwd)) score -= 1;
      if (/^[0-9]+$/.test(pwd)) score -= 2;
      if (/password|123456|qwerty/i.test(pwd)) score -= 2;
      
      return Math.max(0, Math.min(4, Math.floor(score / 2)));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setPassword(value);
      if (showStrengthMeter) {
        setStrength(calculateStrength(value));
      }
      props.onChange?.(e);
    };

    const strengthConfig = {
      0: { label: 'Very weak', color: 'bg-destructive', width: 'w-1/4' },
      1: { label: 'Weak', color: 'bg-destructive', width: 'w-1/4' },
      2: { label: 'Fair', color: 'bg-amber-500', width: 'w-2/4' },
      3: { label: 'Good', color: 'bg-emerald-500', width: 'w-3/4' },
      4: { label: 'Strong', color: 'bg-emerald-600', width: 'w-full' },
    };

    const currentStrength = strengthConfig[strength as keyof typeof strengthConfig];

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            ref={ref}
            type={showPassword ? 'text' : 'password'}
            className={cn('pr-10', className)}
            onChange={handleChange}
            {...props}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="size-4 text-muted-foreground" />
            ) : (
              <Eye className="size-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        {showStrengthMeter && password && (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  currentStrength.color,
                  currentStrength.width
                )}
              />
            </div>
            <p className={cn(
              'text-xs',
              strength <= 1 ? 'text-destructive' : 
              strength === 2 ? 'text-amber-600' : 
              'text-emerald-600'
            )}>
              Password strength: {currentStrength.label}
            </p>
          </div>
        )}
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
