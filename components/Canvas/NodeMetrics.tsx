import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Badge } from "@/components/Ui/buttons";
import { Input, Label, Textarea } from "@/components/Ui/form-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Ui/layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/Ui/data-display";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { NodeMetric } from "@shared/schema";

interface NodeMetricsProps {
  canvasId: string;
  nodeId: string;
}

interface MetricFormData {
  metricKey: string;
  metricValueNumeric?: string;
  metricValueText?: string;
  periodStart?: string;
  periodEnd?: string;
}

export function NodeMetrics({ canvasId, nodeId }: NodeMetricsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMetric, setEditingMetric] = useState<NodeMetric | null>(null);
  const [formData, setFormData] = useState<MetricFormData>({
    metricKey: '',
    metricValueNumeric: '',
    metricValueText: '',
    periodStart: '',
    periodEnd: ''
  });

  // Fetch metrics for this node
  const { data: metrics, isLoading } = useQuery<NodeMetric[]>({
    queryKey: ['/api/canvases', canvasId, 'nodes', nodeId, 'metrics'],
    retry: false,
  });

  // Create metric mutation
  const createMutation = useMutation({
    mutationFn: async (data: MetricFormData) => {
      return await apiRequest("POST", `/api/canvases/${canvasId}/nodes/${nodeId}/metrics`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/canvases', canvasId, 'nodes', nodeId, 'metrics']
      });
      setShowAddDialog(false);
      setFormData({ metricKey: '', metricValueNumeric: '', metricValueText: '', periodStart: '', periodEnd: '' });
      toast({
        title: "성공",
        description: "지표가 저장되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "오류",
        description: "지표 저장에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Update metric mutation
  const updateMutation = useMutation({
    mutationFn: async ({ metricId, data }: { metricId: string; data: MetricFormData }) => {
      return await apiRequest("PUT", `/api/canvases/${canvasId}/nodes/${nodeId}/metrics/${metricId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/canvases', canvasId, 'nodes', nodeId, 'metrics']
      });
      setEditingMetric(null);
      setFormData({ metricKey: '', metricValueNumeric: '', metricValueText: '', periodStart: '', periodEnd: '' });
      toast({
        title: "성공",
        description: "지표가 업데이트되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "오류",
        description: "지표 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Delete metric mutation
  const deleteMutation = useMutation({
    mutationFn: async (metricId: string) => {
      return await apiRequest("DELETE", `/api/canvases/${canvasId}/nodes/${nodeId}/metrics/${metricId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/canvases', canvasId, 'nodes', nodeId, 'metrics']
      });
      toast({
        title: "성공",
        description: "지표가 삭제되었습니다.",
      });
    },
    onError: (error) => {
      toast({
        title: "오류",
        description: "지표 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.metricKey.trim()) {
      toast({
        title: "오류",
        description: "지표 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (editingMetric) {
      updateMutation.mutate({ metricId: editingMetric.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (metric: NodeMetric) => {
    setEditingMetric(metric);
    setFormData({
      metricKey: metric.metricKey,
      metricValueNumeric: metric.metricValueNumeric?.toString() || '',
      metricValueText: metric.metricValueText || '',
      periodStart: metric.periodStart ? new Date(metric.periodStart).toISOString().split('T')[0] : '',
      periodEnd: metric.periodEnd ? new Date(metric.periodEnd).toISOString().split('T')[0] : ''
    });
  };

  const handleDelete = (metricId: string) => {
    if (confirm('이 지표를 삭제하시겠습니까?')) {
      deleteMutation.mutate(metricId);
    }
  };

  const resetForm = () => {
    setFormData({ metricKey: '', metricValueNumeric: '', metricValueText: '', periodStart: '', periodEnd: '' });
    setEditingMetric(null);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">노드 지표</h3>
        <Dialog open={showAddDialog || !!editingMetric} onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <i className="fas fa-plus mr-2"></i>
              지표 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMetric ? '지표 편집' : '새 지표 추가'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="metricKey">지표 이름 *</Label>
                <Input
                  id="metricKey"
                  value={formData.metricKey}
                  onChange={(e) => setFormData({ ...formData, metricKey: e.target.value })}
                  placeholder="예: 클릭률, 전환율, 오픈률"
                />
              </div>
              <div>
                <Label htmlFor="metricValueNumeric">수치 값</Label>
                <Input
                  id="metricValueNumeric"
                  type="number"
                  step="0.01"
                  value={formData.metricValueNumeric}
                  onChange={(e) => setFormData({ ...formData, metricValueNumeric: e.target.value })}
                  placeholder="예: 25.5 (%단위 제외)"
                />
              </div>
              <div>
                <Label htmlFor="metricValueText">텍스트 값</Label>
                <Textarea
                  id="metricValueText"
                  value={formData.metricValueText}
                  onChange={(e) => setFormData({ ...formData, metricValueText: e.target.value })}
                  placeholder="추가 설명이나 텍스트 형태의 지표값"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="periodStart">시작일</Label>
                  <Input
                    id="periodStart"
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="periodEnd">종료일</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? '저장 중...' : '저장'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddDialog(false);
                    resetForm();
                  }}
                >
                  취소
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!metrics || metrics.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-chart-line text-4xl mb-4"></i>
          <p>아직 입력된 지표가 없습니다.</p>
          <p className="text-sm">노드의 성과를 추적할 지표를 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.map((metric) => (
            <Card key={metric.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{metric.metricKey}</h4>
                      <Badge variant="outline" className="text-xs">
                        {metric.source === 'manual' ? '수동' : '자동'}
                      </Badge>
                    </div>
                    
                    {metric.metricValueNumeric !== null && (
                      <div className="text-2xl font-bold text-blue-600 mb-1">
                        {metric.metricValueNumeric}
                      </div>
                    )}
                    
                    {metric.metricValueText && (
                      <p className="text-sm text-gray-600 mb-2">{metric.metricValueText}</p>
                    )}
                    
                    {(metric.periodStart || metric.periodEnd) && (
                      <div className="text-xs text-gray-500">
                        {metric.periodStart && new Date(metric.periodStart).toLocaleDateString()} 
                        {metric.periodStart && metric.periodEnd && ' - '}
                        {metric.periodEnd && new Date(metric.periodEnd).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-1 ml-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(metric)}
                    >
                      <i className="fas fa-edit"></i>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(metric.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <i className="fas fa-trash"></i>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}