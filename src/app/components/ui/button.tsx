import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive smooth-transition active:scale-95 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary/80 backdrop-blur-md text-primary-foreground hover:bg-primary/90 border border-primary/20 shadow-sm",
        destructive:
          "bg-destructive/80 backdrop-blur-md text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 border border-destructive/20",
        outline:
          "border border-white/40 bg-white/20 backdrop-blur-md text-foreground hover:bg-white/30 hover:text-accent-foreground dark:bg-black/20 dark:border-white/10 dark:hover:bg-black/30",
        secondary:
          "bg-secondary/60 backdrop-blur-md text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-white/20 dark:hover:bg-white/10 hover:backdrop-blur-sm hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // 리플 이펙트 로직
    const button = e.currentTarget;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${e.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add("absolute", "rounded-full", "bg-white/30", "animate-ripple", "pointer-events-none");

    const existingRipple = button.querySelector(".animate-ripple");
    if (existingRipple) existingRipple.remove();
    button.appendChild(circle);

    if (onClick) onClick(e);
  };

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      onClick={asChild ? onClick : handleClick}
      {...props}
    />
  );
}

export { Button, buttonVariants };