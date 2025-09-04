import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/Ui/data-display";
import { Button, Badge } from "@/components/Ui/buttons";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AIFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasId: string;
}

interface FeedbackItem {
  nodeId: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
  rationale: string;
}

interface FeedbackRun {
  id: string;
  canvasId: string;
  flowHash: string;
  kbHash: string;
  createdAt: Date;
}

interface FeedbackResponse {
  run: FeedbackRun;
  items: FeedbackItem[];
}

export default function AIFeedbackModal({
  open,
  onOpenChange,
  canvasId,
}: AIFeedbackModalProps) {
  const { toast } = useToast();

  // Fetch latest feedback
  const { data: feedback, isLoading, error } = useQuery<FeedbackResponse>({
    queryKey: ["/api/canvases", canvasId, "feedback", "latest"],
    enabled: open,
    retry: false,
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return "fas fa-times";
      case "medium":
        return "fas fa-exclamation";
      case "low":
        return "fas fa-check";
      default:
        return "fas fa-info";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "border-red-200 bg-red-50";
      case "medium":
        return "border-orange-200 bg-orange-50";
      case "low":
        return "border-green-200 bg-green-50";
      default:
        return "border-gray-200 bg-gray-50";
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-200 text-red-800";
      case "medium":
        return "bg-orange-200 text-orange-800";
      case "low":
        return "bg-green-200 text-green-800";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  const getSeverityIconColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-orange-500";
      case "low":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  const getNodeDisplayName = (nodeId: string) => {
    // Map node IDs to display names
    const nodeNames: Record<string, string> = {
      "email-1": "Welcome Email",
      "landing-1": "랜딩 페이지",
      "social-1": "소셜 미디어",
      "crm-1": "SMS 마케팅",
    };
    return nodeNames[nodeId] || nodeId;
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "high":
        return "중요도: 높음";
      case "medium":
        return "중요도: 중간";
      case "low":
        return "잘 설계됨";
      default:
        return "정보";
    }
  };

  // Mock feedback data if no real data is available
  const mockFeedback: FeedbackResponse = {
    run: {
      id: "mock-run",
      canvasId,
      flowHash: "mock-hash",
      kbHash: "mock-kb-hash",
      createdAt: new Date(),
    },
    items: [
      {
        nodeId: "email-1",
        severity: "medium",
        suggestion: "이메일 제목에 개인화 요소를 추가하면 오픈율을 15-25% 향상시킬 수 있습니다.",
        rationale: '추천: "{{name}}님, 환영합니다!" 형태로 개인화 적용',
      },
      {
        nodeId: "landing-1",
        severity: "low",
        suggestion: "현재 구조가 업계 모범 사례를 잘 따르고 있습니다. 명확한 가치 제안과 CTA 배치가 우수합니다.",
        rationale: "업로드하신 마케팅 가이드의 원칙을 잘 적용하고 있습니다.",
      },
      {
        nodeId: "crm-1",
        severity: "high",
        suggestion: "SMS 발송 시점이 부적절합니다. 이메일 수신 직후보다는 24-48시간 후 발송하는 것이 효과적입니다.",
        rationale: "유튜브 영상에서 언급된 '2단계 지연 전략'을 적용해보세요.",
      },
    ],
  };

  const displayFeedback = feedback || mockFeedback;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-brain text-primary-foreground text-sm"></i>
            </div>
            <DialogTitle>두더지ai</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-96">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm text-muted-foreground">AI가 퍼널을 분석하고 있습니다...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-exclamation-triangle text-red-500"></i>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">분석 실패</h3>
              <p className="text-muted-foreground mb-4">AI 분석에 실패했습니다. 다시 시도해주세요.</p>
              <Button onClick={() => onOpenChange(false)}>
                닫기
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {displayFeedback.items.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-check text-green-500"></i>
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">완벽한 퍼널입니다!</h3>
                  <p className="text-muted-foreground">현재 퍼널에서 개선이 필요한 부분을 찾지 못했습니다.</p>
                </div>
              ) : (
                displayFeedback.items.map((item, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${getSeverityColor(item.severity)}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        item.severity === "high" ? "bg-red-500" :
                        item.severity === "medium" ? "bg-orange-500" : "bg-green-500"
                      }`}>
                        <i className={`${getSeverityIcon(item.severity)} text-primary-foreground text-xs`}></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-foreground">
                            {getNodeDisplayName(item.nodeId)}
                          </h4>
                          <Badge className={getSeverityBadgeColor(item.severity)}>
                            {getSeverityLabel(item.severity)}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground mb-2">{item.suggestion}</p>
                        {item.rationale && (
                          <p className="text-xs text-muted-foreground">{item.rationale}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <div className="space-x-3">
            <Button variant="secondary">
              피드백 저장
            </Button>
            <Button 
              disabled={!displayFeedback.items.length}
              onClick={() => {
                toast({ title: "추천사항이 적용되었습니다!" });
                onOpenChange(false);
              }}
            >
              추천사항 적용
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
