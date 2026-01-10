import { cn } from "@/lib/utils";

interface ZenoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  showSubtitle?: boolean;
  variant?: "light" | "dark" | "auto";
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  sm: {
    container: "h-8 w-8",
    letter: "text-lg",
    text: "text-sm",
    subtitle: "text-[10px]",
  },
  md: {
    container: "h-10 w-10",
    letter: "text-xl",
    text: "text-base",
    subtitle: "text-xs",
  },
  lg: {
    container: "h-12 w-12",
    letter: "text-2xl",
    text: "text-lg",
    subtitle: "text-xs",
  },
  xl: {
    container: "h-20 w-20",
    letter: "text-4xl",
    text: "text-3xl",
    subtitle: "text-sm",
  },
};

export function ZenoLogo({ 
  size = "md", 
  showText = true, 
  showSubtitle = false,
  variant = "auto",
  className,
  onClick 
}: ZenoLogoProps) {
  const sizes = sizeClasses[size];
  
  const textColorClass = variant === "light" 
    ? "text-white" 
    : variant === "dark" 
      ? "bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent"
      : "bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent";

  const subtitleColorClass = variant === "light"
    ? "text-white/70"
    : "text-muted-foreground";

  return (
    <div 
      className={cn("flex items-center gap-3", onClick && "cursor-pointer", className)}
      onClick={onClick}
      data-testid="zeno-logo"
    >
      <div className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20",
        sizes.container
      )}>
        <span className={cn("font-black text-white tracking-tighter", sizes.letter)}>Z</span>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-black tracking-tight", sizes.text, textColorClass)}>
            Zeno
          </span>
          {showSubtitle && (
            <span className={cn(subtitleColorClass, sizes.subtitle)}>
              B2B Platform
            </span>
          )}
        </div>
      )}
    </div>
  );
}
