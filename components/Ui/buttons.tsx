/**
 * Buttons - 버튼 관련 컴포넌트들
 * 
 * 주요 역할:
 * 1. 기본 버튼 컴포넌트 (Button)
 * 2. 뱃지 컴포넌트 (Badge)
 * 3. AI 피드백 버튼 (AIFeedbackButton)
 * 
 * 핵심 특징:
 * - 다양한 버튼 변형 및 크기 지원
 * - 일관된 호버 및 포커스 상태 처리
 * - 접근성을 고려한 키보드 네비게이션 지원
 * 
 * 주의사항:
 * - asChild prop을 통해 다른 컴포넌트로 렌더링 가능
 * - disabled 상태에서는 포인터 이벤트 비활성화
 * - AI 피드백 버튼은 고정 위치로 배치됨
 */

import * as React from "react"
import { useState } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { useMutation } from "@tanstack/react-query"
import { Bot, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { createToastMessage, ErrorDetectors } from "@/lib/messages/toast-utils"

// Button 컴포넌트
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// Badge 컴포넌트
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// AI Feedback Button 컴포넌트
interface AIFeedbackButtonProps {
  onRequestFeedback: () => void;
}

function AIFeedbackButton({ onRequestFeedback }: AIFeedbackButtonProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // AI feedback request mutation
  const feedbackMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      // 처리 시간 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true };
    },
    onSuccess: () => {
      setIsProcessing(false);
      onRequestFeedback();
    },
    onError: (error) => {
      setIsProcessing(false);
      if (ErrorDetectors.isUnauthorizedError(error)) {
        const authMessage = createToastMessage.authError(error);
        toast(authMessage);
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      const errorMessage = createToastMessage.aiMessage('ERROR', 'ANALYSIS_FAILED');
      toast(errorMessage);
    },
  });

  const handleClick = () => {
    if (isProcessing) return;
    feedbackMutation.mutate();
  };

  return (
    <Button
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-10"
      style={{
        boxShadow: "0 8px 25px -8px rgba(99, 102, 241, 0.4)",
      }}
      onClick={handleClick}
      disabled={isProcessing}
    >
      {isProcessing ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <Bot className="h-6 w-6" />
      )}
    </Button>
  );
}

export { 
  Button, 
  buttonVariants, 
  Badge, 
  badgeVariants, 
  AIFeedbackButton 
}
