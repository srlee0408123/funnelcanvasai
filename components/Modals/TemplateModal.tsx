import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/Ui/data-display";
import { Button, Badge } from "@/components/Ui/buttons";
import { Input } from "@/components/Ui/form-controls";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { FunnelTemplate } from "@shared/schema";

interface TemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasId: string;
}

interface TemplateWithDetails extends FunnelTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  preview?: {
    nodeCount: number;
    category: string;
    difficulty: string;
  };
}

export default function TemplateModal({
  open,
  onOpenChange,
  canvasId,
}: TemplateModalProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});

  // Fetch public templates
  const { data: templates, isLoading: templatesLoading } = useQuery<TemplateWithDetails[]>({
    queryKey: ["/api/templates"],
    select: (data: FunnelTemplate[]) => {
      // Add preview data for display (using stable values based on template ID)
      return data.map(template => {
        // Generate stable random value based on template ID
        const hash = template.id.split('').reduce((a: number, b: string) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        const nodeCount = Math.abs(hash % 8) + 3; // Stable node count between 3-10
        
        return {
          ...template,
          preview: {
            nodeCount,
            category: template.category || "general",
            difficulty: "전문가", // Default difficulty level
          },
        };
      });
    },
    enabled: open,
  });

  // Get selected template details
  const { data: templateDetails } = useQuery({
    queryKey: ["/api/templates", selectedTemplate],
    enabled: !!selectedTemplate,
  });

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error("No template selected");
      
      const response = await apiRequest("POST", "/api/templates/apply", {
        templateId: selectedTemplate,
        canvasId,
        parameters,
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/canvases", canvasId, "state", "latest"] });
      toast({ 
        title: "템플릿이 적용되었습니다!", 
        description: "새로운 노드들이 캔버스 우측에 생성되었습니다."
      });
      onOpenChange(false);
      setSelectedTemplate(null);
      setParameters({});
    },
    onError: (error) => {
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
        title: "템플릿 적용 실패",
        description: "템플릿 적용에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const getTemplateIcon = (category: string) => {
    switch (category) {
      case "education":
        return "fas fa-graduation-cap text-primary-600";
      case "consulting":
        return "fas fa-handshake text-green-600";
      case "app":
        return "fas fa-mobile-alt text-orange-600";
      case "ecommerce":
        return "fas fa-shopping-bag text-pink-600";
      default:
        return "fas fa-project-diagram text-gray-600";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "초급자":
        return "bg-green-100 text-green-700";
      case "중급자":
        return "bg-yellow-100 text-yellow-700";
      case "고급자":
        return "bg-orange-100 text-orange-700";
      case "전문가":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "education":
        return "bg-blue-100 text-blue-700";
      case "consulting":
        return "bg-purple-100 text-purple-700";
      case "app":
        return "bg-red-100 text-red-700";
      case "ecommerce":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Mock templates if none loaded
  const mockTemplates: TemplateWithDetails[] = [
    {
      id: "template-1",
      title: "온라인 강의 판매",
      description: "교육 콘텐츠를 판매하는 퍼널 템플릿",
      category: "education",
      thumbnail: null,
      nodeData: {},
      edgeData: {},
      isPublic: true,
      isOfficial: true,
      createdBy: null,
      usageCount: 0,
      rating: 4.5,
      createdAt: new Date(),
      updatedAt: new Date(),
      preview: {
        nodeCount: 5,
        category: "education",
        difficulty: "초급자",
      },
    },
    {
      id: "template-2",
      title: "컨설팅 서비스",
      description: "B2B 컨설팅 서비스 판매 퍼널",
      category: "consulting",
      thumbnail: null,
      nodeData: {},
      edgeData: {},
      isPublic: true,
      isOfficial: true,
      createdBy: null,
      usageCount: 0,
      rating: 4.2,
      createdAt: new Date(),
      updatedAt: new Date(),
      preview: {
        nodeCount: 7,
        category: "consulting",
        difficulty: "중급자",
      },
    },
    {
      id: "template-3",
      title: "모바일 앱 다운로드",
      description: "모바일 앱 다운로드 유도 퍼널",
      category: "app",
      thumbnail: null,
      nodeData: {},
      edgeData: {},
      isPublic: true,
      isOfficial: true,
      createdBy: null,
      usageCount: 0,
      rating: 4.7,
      createdAt: new Date(),
      updatedAt: new Date(),
      preview: {
        nodeCount: 6,
        category: "app",
        difficulty: "고급자",
      },
    },
    {
      id: "template-4",
      title: "이커머스 복합 퍼널",
      description: "전자상거래 종합 마케팅 퍼널",
      category: "ecommerce",
      thumbnail: null,
      nodeData: {},
      edgeData: {},
      isPublic: true,
      isOfficial: true,
      createdBy: null,
      usageCount: 0,
      rating: 4.3,
      createdAt: new Date(),
      updatedAt: new Date(),
      preview: {
        nodeCount: 9,
        category: "ecommerce",
        difficulty: "전문가",
      },
    },
  ];

  const displayTemplates = templates && templates.length > 0 ? templates : mockTemplates;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>템플릿 선택</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2">
          {templatesLoading ? (
            <div className="flex items-center justify-center py-12">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 min-h-0">
              {displayTemplates.map((template) => (
                <div
                  key={template.id}
                                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedTemplate === template.id
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary"
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className={getTemplateIcon(template.preview?.category || "general")}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground mb-1">{template.title}</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {template.preview?.nodeCount}개 노드로 구성된 퍼널 템플릿
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getCategoryColor(template.preview?.category || "general")}>
                          {template.category || "일반"}
                        </Badge>
                        <Badge className={getDifficultyColor(template.preview?.difficulty || "초급자")}>
                          {template.preview?.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={() => applyTemplateMutation.mutate()}
            disabled={!selectedTemplate || applyTemplateMutation.isPending}
          >
            {applyTemplateMutation.isPending ? "적용 중..." : "선택한 템플릿 적용"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
