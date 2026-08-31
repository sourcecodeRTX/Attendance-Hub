'use client';

import * as React from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface HelpTooltipProps {
  content: string;
  className?: string;
  iconClassName?: string;
  side?: TooltipSide;
}

const TOOLTIP_WIDTH = 256; // w-64 = 16rem = 256px
const TOOLTIP_HEIGHT_ESTIMATE = 80; // Approximate height for most tooltips
const PADDING = 8; // Minimum distance from viewport edge

function useAutoPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  preferredSide: TooltipSide
): TooltipSide {
  const [optimalSide, setOptimalSide] = React.useState<TooltipSide>(preferredSide);

  React.useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setOptimalSide(preferredSide);
      return;
    }

    const calculateOptimalPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate available space in each direction
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceLeft = rect.left;
      const spaceRight = viewportWidth - rect.right;

      // Check if preferred side has enough space
      const hasSpaceForSide = (side: TooltipSide): boolean => {
        switch (side) {
          case 'top':
            return spaceAbove >= TOOLTIP_HEIGHT_ESTIMATE + PADDING;
          case 'bottom':
            return spaceBelow >= TOOLTIP_HEIGHT_ESTIMATE + PADDING;
          case 'left':
            return spaceLeft >= TOOLTIP_WIDTH + PADDING;
          case 'right':
            return spaceRight >= TOOLTIP_WIDTH + PADDING;
        }
      };

      // Also check horizontal centering space for top/bottom positions
      const canCenterHorizontally = () => {
        const centerX = rect.left + rect.width / 2;
        const halfWidth = TOOLTIP_WIDTH / 2;
        return centerX - halfWidth >= PADDING && centerX + halfWidth <= viewportWidth - PADDING;
      };

      // Also check vertical centering space for left/right positions
      const canCenterVertically = () => {
        const centerY = rect.top + rect.height / 2;
        const halfHeight = TOOLTIP_HEIGHT_ESTIMATE / 2;
        return centerY - halfHeight >= PADDING && centerY + halfHeight <= viewportHeight - PADDING;
      };

      // If preferred side works, use it
      if (hasSpaceForSide(preferredSide)) {
        if ((preferredSide === 'top' || preferredSide === 'bottom') && canCenterHorizontally()) {
          setOptimalSide(preferredSide);
          return;
        }
        if ((preferredSide === 'left' || preferredSide === 'right') && canCenterVertically()) {
          setOptimalSide(preferredSide);
          return;
        }
      }

      // Try opposite side first
      const oppositeSides: Record<TooltipSide, TooltipSide> = {
        top: 'bottom',
        bottom: 'top',
        left: 'right',
        right: 'left',
      };
      const opposite = oppositeSides[preferredSide];
      if (hasSpaceForSide(opposite)) {
        if ((opposite === 'top' || opposite === 'bottom') && canCenterHorizontally()) {
          setOptimalSide(opposite);
          return;
        }
        if ((opposite === 'left' || opposite === 'right') && canCenterVertically()) {
          setOptimalSide(opposite);
          return;
        }
      }

      // Try all sides and pick the one with most space
      const sides: TooltipSide[] = ['bottom', 'top', 'right', 'left'];
      const spaceMap: Record<TooltipSide, number> = {
        top: spaceAbove,
        bottom: spaceBelow,
        left: spaceLeft,
        right: spaceRight,
      };

      // Sort by available space and pick the best valid option
      const sortedSides = sides.sort((a, b) => spaceMap[b] - spaceMap[a]);
      for (const side of sortedSides) {
        if (hasSpaceForSide(side)) {
          setOptimalSide(side);
          return;
        }
      }

      // Fallback: use the side with most space even if not ideal
      setOptimalSide(sortedSides[0]);
    };

    calculateOptimalPosition();

    // Recalculate on scroll or resize
    window.addEventListener('scroll', calculateOptimalPosition, true);
    window.addEventListener('resize', calculateOptimalPosition);

    return () => {
      window.removeEventListener('scroll', calculateOptimalPosition, true);
      window.removeEventListener('resize', calculateOptimalPosition);
    };
  }, [isOpen, preferredSide, triggerRef]);

  return optimalSide;
}

export function HelpTooltip({ 
  content, 
  className, 
  iconClassName,
  side = 'top' 
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const tooltipId = React.useId();
  
  const optimalSide = useAutoPosition(buttonRef, isOpen, side);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  React.useEffect(() => {
    if (!isOpen || !isMobile) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-popover border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-popover border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-popover border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-popover border-y-transparent border-l-transparent',
  };

  return (
    <div 
      ref={tooltipRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => !isMobile && setIsOpen(true)}
      onMouseLeave={() => !isMobile && setIsOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => isMobile && setIsOpen(!isOpen)}
        onFocus={() => !isMobile && setIsOpen(true)}
        onBlur={() => !isMobile && setIsOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsOpen(false);
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          iconClassName
        )}
        aria-label="Help"
        aria-describedby={isOpen ? tooltipId : undefined}
      >
        <HelpCircle className="size-4" />
      </button>
      
      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 w-64 rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
            positionClasses[optimalSide]
          )}
        >
          {content}
          <div 
            className={cn(
              'absolute border-4',
              arrowClasses[optimalSide]
            )}
          />
        </div>
      )}
    </div>
  );
}

// Predefined tooltips for common terms
export const HELP_TOOLTIPS = {
  primaryTeacher: 
    "The Primary Teacher is the main instructor responsible for a section. They can manage attendance, assign Class Representatives (CRs), and oversee all section activities.",
  regularTeacher:
    "A Regular Teacher assists with specific subjects in a section. They can mark attendance for their assigned subjects but cannot manage the section's settings.",
  cr:
    "CR stands for Class Representative. This is typically a student who helps manage attendance for their section when teachers are unavailable.",
  section:
    "A Section is a group of students within a branch who take classes together. Each section is linked to a specialisation and may have multiple subjects assigned by the admin.",
  branch:
    "A Branch is a field of study within a department, like 'Computer Science' or 'Mechanical Engineering'. Branches contain multiple specialisations.",
  department:
    "A Department is a major academic division of your institution, like 'Engineering' or 'Arts'. Each department has its own admin.",
  specialisation:
    "A Specialisation is a focused area within a branch, like 'AI & ML' within Computer Science. It helps organize students by their specific field of study.",
  superAdmin:
    "The Super Admin is the top-level administrator who manages the entire university system. They can create departments, view all data, and configure system settings.",
  admin:
    "A Department Admin manages a single department. They can create branches, specialisations, sections, subjects, and assign teachers to subject-section combinations.",
  attendanceThreshold:
    "The minimum attendance percentage required for students. Students below this threshold are flagged as defaulters in reports.",
  dutyLeave:
    "Duty Leave (DL) is when a student is absent from class but on official duty (events, competitions, etc.). DL doesn't count against their attendance.",
  sectionCreate:
    "Create a new section by entering a name, selecting a branch, and optionally choosing a specialisation within that branch.",
  subjectCreate:
    "Create a new subject with a name and code, then select one or more sections where this subject will be taught. Subjects can be assigned to multiple sections.",
  teacherAssignment:
    "Assign subjects and sections to teachers. Select a teacher, then choose subjects. For each subject, select the sections they will teach. Each section can only be assigned to one teacher per subject.",
  teacherRole:
    "Primary Teachers manage a section and can assign CRs and mark attendance. Regular Teachers can only mark attendance for their assigned subjects.",
};
