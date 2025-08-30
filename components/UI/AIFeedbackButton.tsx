import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

interface AIFeedbackButtonProps {
  onRequestFeedback: () => void;
}

export default function AIFeedbackButton({ onRequestFeedback }: AIFeedbackButtonProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // AI feedback request mutation
  const feedbackMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true };
    },
    onSuccess: () => {
      setIsProcessing(false);
      onRequestFeedback();
    },
    onError: (error) => {
      setIsProcessing(false);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "AI 분석 실패",
        description: "AI 분석에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const handleClick = () => {
    if (isProcessing) return;
    feedbackMutation.mutate();
  };

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-10"
        style={{
          boxShadow: "0 8px 25px -8px rgba(99, 102, 241, 0.4)",
        }}
        onClick={handleClick}
        disabled={isProcessing}
      >
        <i className={`${isProcessing ? "fas fa-spinner fa-spin" : "fas fa-brain"} text-xl`}></i>
      </Button>

      {/* Keyboard shortcut indicator */}
      <div className="fixed bottom-20 right-6 text-xs text-gray-500 z-10">
        <div className="bg-white rounded px-2 py-1 shadow-sm border">
          Ctrl + / 또는 Cmd + /
        </div>
      </div>
    </>
  );
}
